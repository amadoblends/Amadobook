import { useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import {
  User, Clock, Scissors, Bell, Shield, HelpCircle,
  LogOut, ChevronRight, Moon, Sun, Building2, BarChart2,
  MessageSquare, Palette
} from 'lucide-react'
import toast from 'react-hot-toast'

const BG=('#0D0D0D'),CARD=('#171717'),CARD2=('#1C1C1E'),BORDER=('#2A2A2A'),ORANGE=('#FF6B1A'),TXT=('#F5F5F5'),TXT2=('#888888'),TXT3=('#555555'),RED=('#EF4444')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}
const CSS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp 0.25s ease both}*{box-sizing:border-box}`

const SECTIONS = [
  {
    title: 'Business',
    items: [
      { icon:User,        label:'Profile',          sub:'Edit your public profile',   path:'/barber/profile'       },
      { icon:Clock,       label:'Working Hours',    sub:'Set your availability',       path:'/barber/availability'  },
      { icon:Scissors,    label:'Services',         sub:'Manage your service menu',    path:'/barber/services'      },
    ]
  },
  {
    title: 'Tools',
    items: [
      { icon:BarChart2,   label:'Reports',          sub:'View earnings & analytics',   path:'/barber/reports'       },
      { icon:MessageSquare,label:'Broadcast',       sub:'Message your clients',        path:'/barber/broadcast'     },
    ]
  },
  {
    title: 'Preferences',
    items: [
      { icon:Bell,        label:'Notifications',    sub:'Push & email alerts',         soon:true },
      { icon:Shield,      label:'Privacy & Security',sub:'Password, 2FA',             soon:true },
    ]
  },
  {
    title: 'Support',
    items: [
      { icon:HelpCircle,  label:'Help & Support',   sub:'FAQs and contact us',         soon:true },
    ]
  },
]

export default function BarberSettings() {
  const { signOut, userData } = useAuth()
  const { theme, toggleTheme, timeFormat, setTimeFormat } = useTheme()
  const navigate = useNavigate()

  async function handleSignOut() {
    localStorage.removeItem('ab_last_active')
    await signOut()
    navigate('/barber/login')
  }

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100vh',paddingBottom:40,...F}}>
        <div style={{padding:'16px 18px',maxWidth:600,margin:'0 auto'}}>

          {/* Header */}
          <div className="fade-up" style={{marginBottom:24}}>
            <h1 style={{color:TXT,fontWeight:800,fontSize:22,margin:'0 0 2px',letterSpacing:'-0.4px'}}>Settings</h1>
            <p style={{color:TXT2,fontSize:13,margin:0}}>App preferences & configuration</p>
          </div>

          {/* Profile mini card */}
          <div className="fade-up" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'16px 18px',marginBottom:20,display:'flex',alignItems:'center',gap:14,cursor:'pointer'}} onClick={()=>navigate('/barber/profile')}>
            <div style={{width:48,height:48,borderRadius:'50%',overflow:'hidden',background:CARD2,border:`2px solid ${ORANGE}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:17,color:ORANGE,flexShrink:0}}>
              {userData?.photoURL
                ? <img src={userData.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                : `${userData?.firstName?.[0]||''}${userData?.lastName?.[0]||''}`}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{color:TXT,fontWeight:700,fontSize:16,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{userData?.firstName} {userData?.lastName}</p>
              <p style={{color:TXT2,fontSize:13,margin:0}}>Barber · View profile</p>
            </div>
            <ChevronRight size={16} color={TXT3}/>
          </div>

          {/* Appearance */}
          <div className="fade-up" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,overflow:'hidden',marginBottom:20}}>
            <div style={{padding:'14px 18px',borderBottom:`1px solid ${BORDER}`}}>
              <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',margin:0}}>APPEARANCE</p>
            </div>

            {/* Theme */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:`1px solid ${BORDER}`}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:CARD2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {theme==='dark' ? <Moon size={16} color={TXT2}/> : <Sun size={16} color={ORANGE}/>}
                </div>
                <div>
                  <p style={{color:TXT,fontWeight:600,fontSize:14,margin:'0 0 1px'}}>Theme</p>
                  <p style={{color:TXT2,fontSize:12,margin:0}}>{theme==='dark'?'Dark mode':'Light mode'}</p>
                </div>
              </div>
              <button onClick={toggleTheme}
                style={{background:theme==='dark'?CARD2:ORANGE,border:`1px solid ${theme==='dark'?BORDER:ORANGE}`,borderRadius:22,padding:'7px 16px',color:theme==='dark'?TXT2:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',...F,transition:'all 0.2s'}}>
                {theme==='dark'?'Dark':'Light'}
              </button>
            </div>

            {/* Time format */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px'}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:CARD2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Clock size={16} color={TXT2}/>
                </div>
                <div>
                  <p style={{color:TXT,fontWeight:600,fontSize:14,margin:'0 0 1px'}}>Time Format</p>
                  <p style={{color:TXT2,fontSize:12,margin:0}}>How times appear</p>
                </div>
              </div>
              <div style={{display:'flex',background:CARD2,borderRadius:10,padding:2,border:`1px solid ${BORDER}`}}>
                {['12h','24h'].map(v=>(
                  <button key={v} onClick={()=>setTimeFormat?.(v)}
                    style={{padding:'6px 12px',borderRadius:8,border:'none',cursor:'pointer',background:timeFormat===v?ORANGE:'transparent',color:timeFormat===v?'#fff':TXT2,fontWeight:700,fontSize:12,...F,transition:'all 0.15s'}}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sections */}
          {SECTIONS.map(section => (
            <div key={section.title} className="fade-up" style={{marginBottom:20}}>
              <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',margin:'0 0 8px',paddingLeft:4}}>{section.title.toUpperCase()}</p>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,overflow:'hidden'}}>
                {section.items.map((item,i)=>{
                  const Icon = item.icon
                  return (
                    <button key={item.label}
                      onClick={()=>{ if(item.path) navigate(item.path); else toast('Coming soon! 🚧',{icon:'🔧'}) }}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderBottom:i<section.items.length-1?`1px solid ${BORDER}`:'none',background:'transparent',border:'none',cursor:'pointer',textAlign:'left',...F,transition:'background 0.1s'}}>
                      <div style={{width:36,height:36,borderRadius:10,background:item.soon?BG:CARD2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Icon size={16} color={item.soon?TXT3:TXT2}/>
                      </div>
                      <div style={{flex:1}}>
                        <p style={{color:item.soon?TXT2:TXT,fontWeight:600,fontSize:14,margin:'0 0 1px'}}>{item.label}</p>
                        <p style={{color:TXT3,fontSize:12,margin:0}}>{item.sub}</p>
                      </div>
                      {item.soon
                        ? <span style={{background:CARD2,color:TXT3,fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:10}}>Soon</span>
                        : <ChevronRight size={14} color={TXT3}/>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Sign out */}
          <div className="fade-up">
            <button onClick={handleSignOut}
              style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'16px 18px',background:CARD,border:`1px solid rgba(239,68,68,0.2)`,borderRadius:20,cursor:'pointer',textAlign:'left',...F}}>
              <div style={{width:36,height:36,borderRadius:10,background:'rgba(239,68,68,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <LogOut size={16} color={RED}/>
              </div>
              <span style={{color:RED,fontWeight:700,fontSize:15}}>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </BarberLayout>
  )
}