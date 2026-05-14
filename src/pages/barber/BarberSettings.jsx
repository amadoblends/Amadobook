import { useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import {
  Building2, Clock, Scissors, CreditCard, Bell,
  Shield, HelpCircle, LogOut, ChevronRight, Moon, Sun
} from 'lucide-react'
import toast from 'react-hot-toast'

const BG=('#0D0D0D'),CARD=('#171717'),BORDER=('#2A2A2A'),ORANGE=('#FF6B1A'),TXT=('#F5F5F5'),TXT2=('#888888'),TXT3=('#555555')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}
const CSS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');*{box-sizing:border-box}`

const SECTIONS = [
  {
    title: 'Business',
    items: [
      { icon: Building2, label: 'Business Information', path: '/barber/profile' },
      { icon: Clock,     label: 'Working Hours',        path: '/barber/availability' },
      { icon: Scissors,  label: 'Services',             path: '/barber/services' },
    ]
  },
  {
    title: 'Payments',
    items: [
      { icon: CreditCard, label: 'Payment Methods', path: null, soon: true },
    ]
  },
  {
    title: 'Preferences',
    items: [
      { icon: Bell,   label: 'Notifications',       path: null, soon: true },
      { icon: Shield, label: 'Privacy & Security',  path: null, soon: true },
    ]
  },
  {
    title: 'Support',
    items: [
      { icon: HelpCircle, label: 'Help & Support', path: null, soon: true },
    ]
  },
]

export default function BarberSettings() {
  const { signOut } = useAuth()
  const navigate    = useNavigate()
  const { theme, toggleTheme } = useTheme()

  async function handleSignOut() {
    localStorage.removeItem('ab_last_active')
    await signOut()
    navigate('/barber/login')
  }

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100vh',paddingBottom:100,...F}}>
        <div style={{padding:'16px 18px',maxWidth:640,margin:'0 auto'}}>

          <h1 style={{color:TXT,fontWeight:800,fontSize:22,margin:'0 0 22px',letterSpacing:'-0.4px'}}>Settings</h1>

          {/* Theme toggle */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'14px 16px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {theme==='dark' ? <Moon size={16} color={TXT2}/> : <Sun size={16} color={ORANGE}/>}
              <span style={{color:TXT,fontWeight:600,fontSize:14}}>Appearance</span>
            </div>
            <button onClick={toggleTheme}
              style={{background:BORDER,borderRadius:22,padding:'6px 14px',border:'none',color:TXT2,fontSize:13,fontWeight:700,cursor:'pointer',...F}}>
              {theme==='dark' ? 'Dark' : 'Light'}
            </button>
          </div>

          {/* Setting sections */}
          {SECTIONS.map(section => (
            <div key={section.title} style={{marginBottom:20}}>
              <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:8,paddingLeft:4}}>
                {section.title.toUpperCase()}
              </p>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,overflow:'hidden'}}>
                {section.items.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <button key={item.label}
                      onClick={() => {
                        if (item.path) navigate(item.path)
                        else toast('Coming soon!', { icon: '🚧' })
                      }}
                      style={{
                        width:'100%',display:'flex',alignItems:'center',gap:14,padding:'14px 16px',
                        borderBottom: i < section.items.length-1 ? `1px solid ${BORDER}` : 'none',
                        background:'transparent',border:'none',cursor:'pointer',textAlign:'left',...F,
                        transition:'background 0.1s',
                      }}>
                      <div style={{width:32,height:32,borderRadius:10,background:BG,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Icon size={15} color={item.soon ? TXT3 : TXT2}/>
                      </div>
                      <span style={{flex:1,color:item.soon?TXT3:TXT,fontWeight:600,fontSize:14}}>{item.label}</span>
                      {item.soon
                        ? <span style={{background:BORDER,color:TXT3,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10}}>Soon</span>
                        : <ChevronRight size={14} color={TXT3}/>
                      }
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Sign out */}
          <button onClick={handleSignOut}
            style={{
              width:'100%',display:'flex',alignItems:'center',gap:14,padding:'14px 16px',
              background:CARD,border:`1px solid rgba(239,68,68,0.2)`,borderRadius:16,
              cursor:'pointer',textAlign:'left',...F,
            }}>
            <div style={{width:32,height:32,borderRadius:10,background:'rgba(239,68,68,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <LogOut size={15} color="#EF4444"/>
            </div>
            <span style={{color:'#EF4444',fontWeight:700,fontSize:14}}>Log Out</span>
          </button>
        </div>
      </div>
    </BarberLayout>
  )
}
