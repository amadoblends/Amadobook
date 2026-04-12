import { useTheme } from '../../context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

const ACCENTS = ['#FF5C00','#3b82f6','#8b5cf6','#16A34A','#ec4899','#f59e0b','#06b6d4','#ef4444']

export default function ThemeToggle({ showAccents = true }) {
  const { theme, toggleTheme, accent, setAccent, timeFormat, setTimeFormat } = useTheme()
  const isLight = theme === 'light'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Light/Dark */}
      <div>
        <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>APPEARANCE</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 2px' }}>{isLight ? 'Light Mode' : 'Dark Mode'}</p>
            <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{isLight ? 'Switch to dark' : 'Switch to light'}</p>
          </div>
          <button onClick={toggleTheme}
            style={{ width:52, height:28, borderRadius:14, padding:3, border:'none', cursor:'pointer', transition:'background 0.2s', background:isLight?'var(--border)':'var(--accent)', display:'flex', alignItems:'center', justifyContent:isLight?'flex-start':'flex-end' }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:'white', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'all 0.2s' }}>
              {isLight ? <Sun size={12} color="#FF5C00"/> : <Moon size={12} color="#555"/>}
            </div>
          </button>
        </div>
      </div>

      {/* Time format */}
      <div>
        <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>TIME FORMAT</p>
        <div style={{ display:'flex', background:'var(--card)', borderRadius:12, padding:3, border:'1px solid var(--border)' }}>
          {[['12h','12h (AM/PM)'],['24h','24h']].map(([val, lbl]) => (
            <button key={val} onClick={() => setTimeFormat(val)}
              style={{ flex:1, padding:'9px', borderRadius:10, fontWeight:700, fontSize:13, background:timeFormat===val?'var(--accent)':'transparent', color:timeFormat===val?'white':'var(--text-sec)', border:'none', cursor:'pointer', fontFamily:'Monda,sans-serif', transition:'all 0.15s' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      {showAccents && (
        <div>
          <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>ACCENT COLOR</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {ACCENTS.map(c => (
              <button key={c} onClick={() => setAccent(c)}
                style={{ width:28, height:28, borderRadius:'50%', background:c, border:`2.5px solid ${accent===c?'var(--text-pri)':'transparent'}`, cursor:'pointer', transform:accent===c?'scale(1.15)':'scale(1)', transition:'transform 0.1s' }}/>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
