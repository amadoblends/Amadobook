/**
 * EmptyState — reutilizable para estados vacíos
 * Uso: <EmptyState icon="calendar" title="No appointments" subtitle="..." action={{ label:'Book', onClick:fn }}/>
 */
const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const ICONS = {
  calendar:'📅', scissors:'✂️', clients:'👥', reports:'📊',
  services:'💈', broadcast:'📢', search:'🔍', portfolio:'🖼️',
  history:'🕐',  notification:'🔔', empty:'📭', appointments:'📋',
}

export default function EmptyState({ icon, title, subtitle, action, compact = false }) {
  const emoji = ICONS[icon] || icon || '📭'

  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding: compact ? '28px 20px' : '48px 24px', textAlign:'center', ...F }}>
      <div style={{ width: compact?48:64, height: compact?48:64, borderRadius:'50%', background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto', marginBottom: compact?10:16, fontSize: compact?22:28 }}>
        {emoji}
      </div>
      <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize: compact?14:16, margin:'0 0 6px', letterSpacing:'-0.2px' }}>
        {title}
      </p>
      {subtitle && (
        <p style={{ color:'var(--text-sec)', fontSize: compact?12:13, margin: action?'0 0 20px':'0', lineHeight:1.5 }}>
          {subtitle}
        </p>
      )}
      {action && (
        <button onClick={action.onClick}
          style={{ background:'var(--accent)', color:'var(--accent-inv)', border:'none', borderRadius:22, padding: compact?'10px 20px':'12px 28px', fontWeight:700, fontSize: compact?13:14, cursor:'pointer', ...F, transition:'opacity 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          {action.label}
        </button>
      )}
    </div>
  )
}
