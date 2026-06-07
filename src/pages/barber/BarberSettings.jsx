/**
 * BarberSettings — Rediseño
 * ✅ Tema más oscuro y refinado
 * ✅ Iconos con fondo de color
 * ✅ Separación visual más clara
 * ✅ Log Out más prominente
 */
import { useNavigate } from 'react-router-dom'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import {
  Building2, Clock, Scissors, Pause, CreditCard, Bell,
  Shield, HelpCircle, LogOut, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

const BG    = '#0A0A0D'
const CARD  = '#111114'
const CARD2 = '#18181C'
const BORDER= '#1E1E22'
const ORANGE= '#FF6B1A'
const TXT   = '#EDEDF0'
const TXT2  = '#666'
const TXT3  = '#333'
const RED   = '#EF4444'
const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

// Íconos con colores temáticos
const MENU_GROUPS = [
  {
    title: 'Business',
    items: [
      { icon:Building2, label:'Business Information', path:'/barber/profile',      color:'#3B82F6', bg:'rgba(59,130,246,0.12)' },
      { icon:Clock,     label:'Working Hours',        path:'/barber/availability', color:'#A78BFA', bg:'rgba(167,139,250,0.12)' },
      { icon:Scissors,  label:'Services',             path:'/barber/services',     color:'#FF6B1A', bg:'rgba(255,107,26,0.12)'  },
      { icon:Pause,     label:'Breaks',               path:'/barber/availability', color:'#FCD34D', bg:'rgba(252,211,77,0.12)'  },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon:CreditCard, label:'Payments',          soon:true, color:'#22C55E', bg:'rgba(34,197,94,0.12)' },
      { icon:Bell,       label:'Notifications',     soon:true, color:'#F59E0B', bg:'rgba(245,158,11,0.12)' },
      { icon:Shield,     label:'Privacy & Security',soon:true, color:'#6366F1', bg:'rgba(99,102,241,0.12)' },
      { icon:HelpCircle, label:'Help & Support',    soon:true, color:'#64748B', bg:'rgba(100,116,139,0.12)' },
    ],
  },
]

export default function BarberSettings() {
  const { signOut } = useAuth()
  const { timeFormat, setTimeFormat } = useTheme()
  const navigate = useNavigate()

  async function handleSignOut() {
    localStorage.removeItem('ab_last_active')
    await signOut()
    navigate('/barber/login')
  }

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background:BG, minHeight:'100%', paddingBottom:24, ...F }}>
        <div style={{ padding:'12px 14px', maxWidth:540, margin:'0 auto' }}>

          {/* Header */}
          <div className="fu" style={{ marginBottom:16 }}>
            <h1 style={{ color:TXT, fontWeight:800, fontSize:18, margin:0, letterSpacing:'-0.3px' }}>Settings</h1>
          </div>

          {/* Time Format */}
          <div className="fu" style={{
            background:CARD, border:`1px solid ${BORDER}`,
            borderRadius:13, overflow:'hidden', marginBottom:8,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 14px' }}>
              <div style={{
                width:34, height:34, borderRadius:9, flexShrink:0,
                background:'rgba(99,102,241,0.12)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Clock size={15} color='#6366F1'/>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ color:TXT, fontWeight:600, fontSize:13, margin:'0 0 1px' }}>Time Format</p>
                <p style={{ color:TXT2, fontSize:11, margin:0 }}>How times appear throughout the app</p>
              </div>
              <div style={{
                display:'flex', background:CARD2, borderRadius:8,
                padding:2, border:`1px solid ${BORDER}`, gap:1,
              }}>
                {['12h','24h'].map(v => (
                  <button key={v} onClick={() => setTimeFormat(v)}
                    style={{
                      padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer',
                      background: timeFormat===v ? ORANGE : 'transparent',
                      color: timeFormat===v ? '#fff' : TXT2,
                      fontWeight:700, fontSize:11, ...F, transition:'all 0.15s',
                    }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Menu groups */}
          {MENU_GROUPS.map((group, gi) => (
            <div key={group.title} className="fu" style={{ marginBottom:8 }}>
              <p style={{ color:TXT3, fontSize:9, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 5px 2px' }}>
                {group.title.toUpperCase()}
              </p>
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:13, overflow:'hidden' }}>
                {group.items.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <button key={item.label}
                      onClick={() => item.path ? navigate(item.path) : toast('Coming soon 🚧', { icon:'🔧' })}
                      style={{
                        width:'100%', display:'flex', alignItems:'center', gap:11,
                        padding:'11px 14px',
                        borderBottom: i < group.items.length-1 ? `1px solid ${BORDER}` : 'none',
                        background:'transparent', border:'none',
                        cursor:'pointer', textAlign:'left', ...F,
                      }}>
                      <div style={{
                        width:34, height:34, borderRadius:9,
                        background: item.soon ? CARD2 : item.bg,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        flexShrink:0,
                      }}>
                        <Icon size={15} color={item.soon ? TXT3 : item.color}/>
                      </div>
                      <span style={{ flex:1, color:item.soon?TXT2:TXT, fontWeight:600, fontSize:13 }}>
                        {item.label}
                      </span>
                      {item.soon
                        ? <span style={{ background:CARD2, color:TXT3, fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8, border:`1px solid ${BORDER}` }}>Soon</span>
                        : <ChevronRight size={13} color={TXT3}/>
                      }
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Log Out */}
          <div className="fu">
            <button onClick={handleSignOut}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:11,
                padding:'12px 14px',
                background:CARD,
                border:`1px solid rgba(239,68,68,0.18)`,
                borderRadius:13, cursor:'pointer', textAlign:'left', ...F,
              }}>
              <div style={{
                width:34, height:34, borderRadius:9,
                background:'rgba(239,68,68,0.10)',
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0,
              }}>
                <LogOut size={15} color={RED}/>
              </div>
              <span style={{ color:RED, fontWeight:700, fontSize:13 }}>Log Out</span>
            </button>
          </div>

        </div>
      </div>
    </BarberLayout>
  )
}
