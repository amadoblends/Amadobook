/**
 * BarberSettings — Exact template match
 * ✓ Business Information, Working Hours, Services, Breaks, Payments, Notifications, Privacy, Help, Log Out
 * ✓ Working dark/light toggle
 */
import { useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import {
  Building2, Clock, Scissors, Pause, CreditCard, Bell,
  Shield, HelpCircle, LogOut, ChevronRight, Moon, Sun,
} from 'lucide-react'
import toast from 'react-hot-toast'

const BG='#0D0D0D', CARD='#141414', CARD2='#1C1C1E', BORDER='#252525'
const ORANGE='#FF6B1A', TXT='#F0F0F0', TXT2='#666', TXT3='#3A3A3A', RED='#EF4444'
const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.22s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

// Template menu items exactly
const MENU_ITEMS = [
  { icon:Building2, label:'Business Information', path:'/barber/profile' },
  { icon:Clock,     label:'Working Hours',        path:'/barber/availability' },
  { icon:Scissors,  label:'Services',             path:'/barber/services' },
  { icon:Pause,     label:'Breaks',               path:'/barber/availability' },
  { icon:CreditCard,label:'Payments',             soon:true },
  { icon:Bell,      label:'Notifications',        soon:true },
  { icon:Shield,    label:'Privacy & Security',   soon:true },
  { icon:HelpCircle,label:'Help & Support',       soon:true },
]

function Toggle({value,onChange}){
  return<button onClick={()=>onChange(!value)}
    style={{width:44,height:24,borderRadius:12,padding:3,background:value?ORANGE:CARD2,border:`1px solid ${value?ORANGE:BORDER}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:value?'flex-end':'flex-start',transition:'all 0.2s',flexShrink:0}}>
    <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.3)',transition:'all 0.2s'}}/>
  </button>
}

export default function BarberSettings(){
  const{signOut,userData}=useAuth()
  const{theme,toggleTheme,timeFormat,setTimeFormat}=useTheme()
  const navigate=useNavigate()
  const isDark=theme==='dark'

  async function handleSignOut(){
    localStorage.removeItem('ab_last_active')
    await signOut()
    navigate('/barber/login')
  }

  return<BarberLayout>
    <style>{CSS}</style>
    <div style={{background:BG,minHeight:'100%',paddingBottom:24,...F}}>
      <div style={{padding:'14px 16px',maxWidth:540,margin:'0 auto'}}>

        {/* Header */}
        <div className="fu" style={{marginBottom:20}}>
          <h1 style={{color:TXT,fontWeight:800,fontSize:18,margin:0,letterSpacing:'-0.3px'}}>Settings</h1>
        </div>

        {/* Appearance */}
        <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden',marginBottom:10}}>
          {/* Dark/Light */}
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderBottom:`1px solid ${BORDER}`}}>
            <div style={{width:34,height:34,borderRadius:9,background:CARD2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {isDark?<Moon size={15} color={TXT2}/>:<Sun size={15} color={ORANGE}/>}
            </div>
            <div style={{flex:1}}>
              <p style={{color:TXT,fontWeight:600,fontSize:13,margin:'0 0 1px'}}>Theme</p>
              <p style={{color:TXT2,fontSize:11,margin:0}}>{isDark?'Dark mode':'Light mode'}</p>
            </div>
            <Toggle value={!isDark} onChange={()=>toggleTheme()}/>
          </div>
          {/* Time format */}
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px'}}>
            <div style={{width:34,height:34,borderRadius:9,background:CARD2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Clock size={15} color={TXT2}/>
            </div>
            <div style={{flex:1}}>
              <p style={{color:TXT,fontWeight:600,fontSize:13,margin:'0 0 1px'}}>Time Format</p>
              <p style={{color:TXT2,fontSize:11,margin:0}}>How times appear</p>
            </div>
            <div style={{display:'flex',background:CARD2,borderRadius:8,padding:2,border:`1px solid ${BORDER}`}}>
              {['12h','24h'].map(v=>(
                <button key={v} onClick={()=>setTimeFormat(v)}
                  style={{padding:'5px 10px',borderRadius:6,border:'none',cursor:'pointer',background:timeFormat===v?ORANGE:'transparent',color:timeFormat===v?'#fff':TXT2,fontWeight:700,fontSize:11,...F,transition:'all 0.15s'}}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main menu — exact template */}
        <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden',marginBottom:10}}>
          {MENU_ITEMS.map((item,i)=>{
            const Icon=item.icon
            return<button key={item.label}
              onClick={()=>item.path?navigate(item.path):toast('Coming soon 🚧',{icon:'🔧'})}
              style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderBottom:i<MENU_ITEMS.length-1?`1px solid ${BORDER}`:'none',background:'transparent',border:'none',cursor:'pointer',textAlign:'left',...F}}>
              <div style={{width:34,height:34,borderRadius:9,background:item.soon?BG:CARD2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon size={15} color={item.soon?TXT3:TXT2}/>
              </div>
              <span style={{flex:1,color:item.soon?TXT2:TXT,fontWeight:600,fontSize:14}}>{item.label}</span>
              {item.soon
                ?<span style={{background:CARD2,color:TXT3,fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:8}}>Soon</span>
                :<ChevronRight size={14} color={TXT3}/>}
            </button>
          })}
        </div>

        {/* Log out */}
        <div className="fu">
          <button onClick={handleSignOut}
            style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'13px 14px',background:CARD,border:`1px solid rgba(239,68,68,0.2)`,borderRadius:14,cursor:'pointer',textAlign:'left',...F}}>
            <div style={{width:34,height:34,borderRadius:9,background:'rgba(239,68,68,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <LogOut size={15} color={RED}/>
            </div>
            <span style={{color:RED,fontWeight:700,fontSize:14}}>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  </BarberLayout>
}