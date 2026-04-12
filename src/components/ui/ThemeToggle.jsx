import { useTheme } from '../../context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle({ showAccents = true }) {
  const { theme, toggleTheme, accent, setAccent, accents, timeFormat, setTimeFormat } = useTheme()
  const isLight = theme === 'light'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Light/Dark */}
      <div>
        <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10, fontFamily:'Monda,sans-serif' }}>APPEARANCE</p>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'var(--accent)20', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {isLight ? <Sun size={18} style={{color:'var(--accent)'}}/> : <Moon size={18} style={{color:'var(--accent)'}}/>}
            </div>
            <div>
              <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 1px', fontFamily:'Monda,sans-serif' }}>{isLight ? 'Light Mode' : 'Dark Mode'}</p>
              <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>Tap to switch</p>
            </div>
          </div>
          <button onClick={toggleTheme}
            style={{ width:52, height:28, borderRadius:14, padding:3, border:'none', cursor:'pointer', transition:'background 0.2s', background:isLight?'var(--border)':'var(--accent)', display:'flex', alignItems:'center', justifyContent:isLight?'flex-start':'flex-end', flexShrink:0 }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:'white', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
          </button>
        </div>
      </div>

      {/* Time format */}
      <div>
        <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10, fontFamily:'Monda,sans-serif' }}>TIME FORMAT</p>
        <div style={{ display:'flex', background:'var(--bg)', borderRadius:12, padding:3, border:'1px solid var(--border)' }}>
          {[['12h','12h (AM/PM)'],['24h','24h']].map(([val,lbl]) => (
            <button key={val} onClick={() => setTimeFormat(val)}
              style={{ flex:1, padding:'9px', borderRadius:10, fontWeight:700, fontSize:13, background:timeFormat===val?'var(--accent)':'transparent', color:timeFormat===val?'white':'var(--text-sec)', border:'none', cursor:'pointer', fontFamily:'Monda,sans-serif' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Accent — only 3 */}
      {showAccents && (
        <div>
          <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10, fontFamily:'Monda,sans-serif' }}>ACCENT COLOR</p>
          <div style={{ display:'flex', gap:12 }}>
            {accents.map(a => (
              <button key={a.id} onClick={() => setAccent(a.color)}
                style={{ flex:1, padding:'12px 8px', borderRadius:14, border:`2px solid ${accent===a.color?a.color:'var(--border)'}`, background:accent===a.color?a.color+'22':'var(--card)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, transition:'all 0.15s' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:a.color, border:`3px solid ${accent===a.color?'white':'transparent'}`, boxShadow:accent===a.color?`0 0 0 2px ${a.color}`:'none' }}/>
                <span style={{ color:accent===a.color?a.color:'var(--text-sec)', fontSize:11, fontWeight:700, fontFamily:'Monda,sans-serif' }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
