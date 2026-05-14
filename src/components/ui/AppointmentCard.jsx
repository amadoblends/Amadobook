/**
 * AppointmentCard — card compartida para barber y client
 *
 * Props:
 *   appt        — appointment object
 *   variant     — 'barber' | 'client' (default: 'barber')
 *   onClick     — fn(appt)
 *   onCancel    — fn(id)       [opcional]
 *   onReschedule— fn(appt)     [opcional]
 *   formatTime  — fn(timeStr)  [del ThemeContext]
 *   isCurrent   — bool (resalta si es la cita actual)
 */
import { format } from 'date-fns'
import { parseLocalDate, formatCurrency, formatDuration } from '../../utils/helpers'
import { ChevronRight, RefreshCw, X } from 'lucide-react'

const STATUS = {
  confirmed: { bg:'rgba(34,197,94,0.12)',  color:'#22C55E',  label:'Confirmed' },
  pending:   { bg:'rgba(255,107,26,0.14)', color:'#FF6B1A',  label:'Pending'   },
  completed: { bg:'rgba(255,255,255,0.06)',color:'#888888',  label:'Completed' },
  cancelled: { bg:'rgba(239,68,68,0.12)',  color:'#EF4444',  label:'Cancelled' },
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.pending
  return (
    <span style={{ background:s.bg, color:s.color, fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, letterSpacing:'0.04em', whiteSpace:'nowrap' }}>
      {s.label}
    </span>
  )
}

function Avatar({ name, photoURL, size = 40 }) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?'
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', overflow:'hidden', background:'var(--card)', border:'1.5px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:size*0.32, color:'var(--text-sec)', flexShrink:0 }}>
      {photoURL
        ? <img src={photoURL} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>
        : initials}
    </div>
  )
}

export default function AppointmentCard({
  appt,
  variant    = 'barber',
  onClick,
  onCancel,
  onReschedule,
  formatTime,
  isCurrent  = false,
}) {
  if (!appt) return null

  const cancelled = appt.bookingStatus === 'cancelled'
  const completed = appt.bookingStatus === 'completed'
  const upcoming  = !cancelled && !completed

  const accentColor  = 'var(--accent)'
  const borderLeft   = isCurrent
    ? `3px solid var(--accent)`
    : cancelled ? '3px solid rgba(239,68,68,0.4)'
    : completed ? '3px solid rgba(34,197,94,0.3)'
    : '3px solid var(--border)'

  const fmt = formatTime || (t => t)
  const dateStr = appt.date ? format(parseLocalDate(appt.date), 'EEE, MMM d') : '—'

  return (
    <button
      onClick={onClick}
      style={{
        width:'100%', textAlign:'left', cursor: onClick ? 'pointer' : 'default',
        fontFamily:"'DM Sans',system-ui,sans-serif",
        background: isCurrent ? `color-mix(in srgb, var(--accent) 8%, var(--card))` : 'var(--card)',
        border:    `1px solid ${isCurrent ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'var(--border)'}`,
        borderLeft,
        borderRadius: 14,
        padding: '13px 14px',
        marginBottom: 8,
        opacity: cancelled ? 0.6 : 1,
        transition: 'background 0.15s',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>

      {/* Avatar (barber variant shows client photo) */}
      {variant === 'barber' && (
        <Avatar name={appt.clientName} photoURL={appt.clientPhotoURL} size={42} />
      )}

      {/* Time column (barber only) */}
      {variant === 'barber' && (
        <div style={{ display:'flex', flexDirection:'column', minWidth:44, flexShrink:0 }}>
          <span style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-sec)', fontWeight:700, fontSize:12 }}>
            {fmt(appt.startTime)}
          </span>
          <span style={{ color:'var(--text-sec)', fontSize:11, opacity:0.6 }}>
            {fmt(appt.endTime)}
          </span>
        </div>
      )}

      {/* Divider */}
      {variant === 'barber' && (
        <div style={{ width:1, height:26, background:'var(--border)', flexShrink:0 }}/>
      )}

      {/* Main info */}
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {variant === 'barber' ? appt.clientName : dateStr}
        </p>
        <p style={{ color:'var(--text-sec)', fontSize:12, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {variant === 'client'
            ? `${fmt(appt.startTime)} · ${appt.services?.map(s=>s.name).join(', ')}`
            : appt.services?.map(s => s.name).join(', ')
          }
        </p>

        {/* Reschedule / Cancel buttons (client upcoming only) */}
        {variant === 'client' && upcoming && (onCancel || onReschedule) && (
          <div style={{ display:'flex', gap:6, marginTop:8 }} onClick={e => e.stopPropagation()}>
            {onReschedule && (
              <button onClick={() => onReschedule(appt)}
                style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.05)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 10px', color:'var(--text-sec)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                <RefreshCw size={10}/> Reschedule
              </button>
            )}
            {onCancel && (
              <button onClick={() => onCancel(appt.id)}
                style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.18)', borderRadius:8, padding:'5px 10px', color:'#EF4444', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',system-ui,sans-serif" }}>
                <X size={10}/> Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Price + status */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
        <span style={{ color: cancelled ? 'var(--text-sec)' : 'var(--accent)', fontWeight:800, fontSize:13, textDecoration: cancelled ? 'line-through' : 'none' }}>
          {formatCurrency(appt.totalWithTip || appt.totalPrice)}
        </span>
        <StatusBadge status={appt.bookingStatus} />
      </div>

      {onClick && <ChevronRight size={13} color="var(--text-sec)" style={{ flexShrink:0 }}/>}
    </button>
  )
}
