import { useTheme } from '../../context/ThemeContext'
import { Sun, Sunset, Moon } from 'lucide-react'

const ICONS = { day: Sun, evening: Sunset, night: Moon }
const ACCENTS = ['#FF5C00','#3b82f6','#8b5cf6','#16A34A','#ec4899','#f59e0b','#06b6d4']

export default function ThemeToggle({ showAccents = false }) {
  const { theme, setTheme, accent, setAccent, themes } = useTheme()
  const Icon = ICONS[theme]

  return (
    <div className="flex flex-col gap-3">
      {/* Theme selector */}
      <div className="flex gap-2">
        {Object.entries(themes).map(([key, t]) => {
          const TIcon = ICONS[key]
          return (
            <button key={key} onClick={() => setTheme(key)}
              className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
              style={{
                background: theme === key ? 'var(--accent)22' : 'var(--surface)',
                border: `1.5px solid ${theme === key ? 'var(--accent)' : 'var(--border)'}`,
              }}>
              <TIcon size={18} style={{ color: theme === key ? 'var(--accent)' : 'var(--text-sec)' }} />
              <span className="text-xs font-semibold" style={{ color: theme === key ? 'var(--accent)' : 'var(--text-sec)' }}>{t.name}</span>
            </button>
          )
        })}
      </div>

      {/* Accent color picker */}
      {showAccents && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-sec)' }}>ACCENT COLOR</p>
          <div className="flex gap-2 flex-wrap">
            {ACCENTS.map(color => (
              <button key={color} onClick={() => setAccent(color)}
                className="w-9 h-9 rounded-xl transition-all"
                style={{
                  background: color,
                  transform: accent === color ? 'scale(1.15)' : 'scale(1)',
                  border: accent === color ? '2px solid white' : '2px solid transparent',
                  boxShadow: accent === color ? `0 0 12px ${color}88` : 'none',
                }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
