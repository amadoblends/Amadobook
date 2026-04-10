import { useTheme } from '../../context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

const ACCENTS = ['#FF5C00','#3b82f6','#8b5cf6','#16A34A','#ec4899','#f59e0b','#06b6d4','#ef4444']

export default function ThemeToggle({ showAccents = true }) {
  const { theme, toggleTheme, accent, setAccent } = useTheme()
  const isLight = theme === 'light'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Light/Dark toggle */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 2px' }}>
            {isLight ? 'Light Mode' : 'Dark Mode'}
          </p>
          <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>
            {isLight ? 'Switch to dark' : 'Switch to light'}
          </p>
        </div>
        {/* Toggle switch */}
        <button onClick={toggleTheme}
          style={{ width:52, height:28, borderRadius:14, padding:3, border:'none', cursor:'pointer', transition:'background 0.2s', background:isLight?'var(--border)':'var(--accent)', display:'flex', alignItems:'center', justifyContent:isLight?'flex-start':'flex-end' }}>
          <div style={{ width:22, height:22, borderRadius:'50%', background:'white', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'all 0.2s' }}>
            {isLight ? <Sun size={12} color="#FF5C00"/> : <Moon size={12} color="#555"/>}
          </div>
        </button>
      </div>

      {/* Accent color picker */}
      {showAccents && (
        <div>
          <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>ACCENT COLOR</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {ACCENTS.map(c => (
              <button key={c} onClick={() => setAccent(c)}
                style={{ width:28, height:28, borderRadius:'50%', background:c, border:`2.5px solid ${accent===c?'var(--text-pri)':'transparent'}`, cursor:'pointer', transition:'transform 0.1s', transform:accent===c?'scale(1.15)':'scale(1)' }}/>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
