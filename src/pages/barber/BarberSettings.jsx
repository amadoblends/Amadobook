/**
 * BarberSettings — Migrated to Design System
 * ✓ Tema más oscuro y refinado (Light/Dark mode support)
 * ✓ Iconos con fondo de color usando CSS variables
 * ✓ Separación visual más clara
 * ✓ Log Out más prominente
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

const F = { fontFamily: "'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

// Íconos con colores temáticos del Design System
const MENU_GROUPS = [
  {
    title: 'Business',
    items: [
      { icon:Building2, label:'Business Information', path:'/barber/profile',      color:'var(--accent)', bg:'var(--accent-soft)' },
      { icon:Clock,     label:'Working Hours',        path:'/barber/availability', color:'var(--purple)', bg:'var(--purple-soft)' },
      { icon:Scissors,  label:'Services',             path:'/barber/services',     color:'var(--accent)', bg:'var(--accent-soft)' },
      { icon:Pause,     label:'Breaks',               path:'/barber/availability', color:'var(--amber)',  bg:'var(--amber-soft)'  },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon:CreditCard, label:'Payments',           soon:true, color:'var(--green)',  bg:'var(--green-soft)' },
      { icon:Bell,       label:'Notifications',      soon:true, color:'var(--amber)',  bg:'var(--amber-soft)' },
      { icon:Shield,     label:'Privacy & Security', soon:true, color:'var(--purple)', bg:'var(--purple-soft)' },
      { icon:HelpCircle, label:'Help & Support',     soon:true, color:'var(--text-sec)', bg:'var(--card2)' },
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
      <div style={{ background:'var(--bg)', minHeight:'100%', paddingBottom:24, ...F }}>
        <div style={{ padding:'12px 14px', maxWidth:540, margin:'0 auto' }}>

          {/* Header */}
          <div className="fu" style={{ marginBottom:16 }}>
            <h1 style={{ color:'var(--text-pri)', fontWeight:800, fontSize:18, margin:0, letterSpacing:'-0.3px' }}>Settings</h1>
          </div>

          {/* Time Format */}
          <div className="fu" style={{
            background:'var(--card)', border:'1px solid var(--border)',
            borderRadius:13, overflow:'hidden', marginBottom:8,
            boxShadow:'var(--shadow-sm)'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 14px' }}>
              <div style={{
                width:34, height:34, borderRadius:9, flexShrink:0,
                background:'var(--purple-soft)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Clock size={15} color='var(--purple)'/>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:13, margin:'0 0 1px' }}>Time Format</p>
                <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>How times appear throughout the app</p>
              </div>
              <div style={{
                display:'flex', background:'var(--card2)', borderRadius:8,
                padding:2, border:'1px solid var(--border)', gap:1,
              }}>
                {['12h','24h'].map(v => (
                  <button key={v} onClick={() => setTimeFormat(v)}
                    style={{
                      padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer',
                      background: timeFormat===v ? 'var(--accent)' : 'transparent',
                      color: timeFormat===v ? '#fff' : 'var(--text-sec)',
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
              <p style={{ color:'var(--text-ter)', fontSize:9, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 5px 2px' }}>
                {group.title.toUpperCase()}
              </p>
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:13, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                {group.items.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <button key={item.label}
                      onClick={() => item.path ? navigate(item.path) : toast('Coming soon 🚧', { icon:'🔧' })}
                      style={{
                        width:'100%', display:'flex', alignItems:'center', gap:11,
                        padding:'11px 14px',
                        borderBottom: i < group.items.length-1 ? '1px solid var(--border)' : 'none',
                        background:'transparent', borderTop:'none', borderLeft:'none', borderRight:'none',
                        cursor:'pointer', textAlign:'left', ...F,
                      }}>
                      <div style={{
                        width:34, height:34, borderRadius:9,
                        background: item.soon ? 'var(--card2)' : item.bg,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        flexShrink:0,
                      }}>
                        <Icon size={15} color={item.soon ? 'var(--text-ter)' : item.color}/>
                      </div>
                      <span style={{ flex:1, color:item.soon?'var(--text-sec)':'var(--text-pri)', fontWeight:600, fontSize:13 }}>
                        {item.label}
                      </span>
                      {item.soon
                        ? <span style={{ background:'var(--card2)', color:'var(--text-ter)', fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:8, border:'1px solid var(--border)' }}>Soon</span>
                        : <ChevronRight size={13} color="var(--text-ter)"/>
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
                background:'var(--card)',
                border:'1px solid var(--red-soft)',
                borderRadius:13, cursor:'pointer', textAlign:'left', ...F,
                boxShadow:'var(--shadow-sm)'
              }}>
              <div style={{
                width:34, height:34, borderRadius:9,
                background:'var(--red-soft)',
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0,
              }}>
                <LogOut size={15} color="var(--red)"/>
              </div>
              <span style={{ color:'var(--red)', fontWeight:700, fontSize:13 }}>Log Out</span>
            </button>
          </div>

        </div>
      </div>
    </BarberLayout>
  )
}