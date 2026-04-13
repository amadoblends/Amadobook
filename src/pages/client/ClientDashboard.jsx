/**
 * ClientDashboard — AmadoBook Premium v2
 * Black / Yellow / White — Editorial Luxury
 * 4 tabs: Home · Calendar · Bookings · Profile
 */
import { useEffect, useState, useRef, memo } from 'react'
import {
  collection, query, where, getDocs, doc, updateDoc,
  getDoc, setDoc, serverTimestamp
} from 'firebase/firestore'
import { db, storage } from '../../lib/firebase'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, parseLocalDate, generateTimeSlots } from '../../utils/helpers'
import { useTheme } from '../../context/ThemeContext'
import { T, statusColor } from '../../utils/designTokens'
import {
  format, isToday, isTomorrow, differenceInDays,
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameDay, isSameMonth,
  addMonths, subMonths, addDays, startOfDay
} from 'date-fns'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Home, CalendarDays, ClipboardList, User, Star,
  Scissors, ArrowUpRight, ArrowDownRight, Bell,
  ChevronRight, ChevronLeft, X, Plus, Clock,
  MapPin, Phone, Mail, Check, RefreshCw, Bookmark
} from 'lucide-react'
import ImportantMessagePopup from '../../components/ui/ImportantMessagePopup'

const F = { fontFamily: T.font }

/* ─────────────────────────── ATOMS ───────────────────────────────────── */

const Avatar = memo(({ src, name = '', size = 44, radius = '50%', border }) => (
  <div style={{
    width: size, height: size, borderRadius: radius, overflow: 'hidden', flexShrink: 0,
    background: T.yellowDim, border: border || `1.5px solid ${T.borderMid}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: T.yellow, fontWeight: 800, fontSize: size * 0.33, ...F,
  }}>
    {src
      ? <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
      : name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
  </div>
))

const Pill = ({ label, color = T.yellow, bg }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
    padding: '3px 9px', borderRadius: 20,
    background: bg || (color + '18'), color,
    textTransform: 'uppercase', ...F,
  }}>{label}</span>
)

const Divider = ({ my = 14 }) => (
  <div style={{ height: 1, background: T.border, margin: `${my}px 0` }} />
)

const Spin = ({ size = 20, color = T.yellow }) => (
  <div style={{
    width: size, height: size, border: `2.5px solid ${color}`,
    borderTopColor: 'transparent', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite', flexShrink: 0,
  }} />
)

/* ─────────────────────── NOTIFICATION BELL ────────────────────────────── */
function NotifBell({ userId, onOpen }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!userId) return
    const load = () => getDocs(query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    )).then(s => setCount(s.size))
    load()
    const iv = setInterval(load, 25000)
    return () => clearInterval(iv)
  }, [userId])

  return (
    <button onClick={onOpen} style={{
      position: 'relative', background: T.bgRaised, border: `1px solid ${T.border}`,
      borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center',
      justifyContent: 'center', cursor: 'pointer', color: T.textSec, flexShrink: 0,
    }}>
      <Bell size={18} />
      {count > 0 && (
        <div style={{
          position: 'absolute', top: 7, right: 7, width: 8, height: 8,
          borderRadius: '50%', background: T.yellow, boxShadow: `0 0 6px ${T.yellow}`,
        }} />
      )}
    </button>
  )
}

/* ─────────────────────── STAT CARD ────────────────────────────────────── */
function StatCard({ label, value, sub, trend, primary }) {
  return (
    <div style={{
      flex: 1, background: primary ? T.yellow : T.bgCard,
      border: primary ? 'none' : `1px solid ${T.border}`,
      borderRadius: 20, padding: '18px 16px',
      boxShadow: primary ? T.yellowGlow : T.shadow,
    }}>
      <p style={{ color: primary ? T.textInv + 'aa' : T.textSec, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', margin: '0 0 10px', ...F }}>
        {label.toUpperCase()}
      </p>
      <p style={{ color: primary ? T.textInv : T.textPri, fontWeight: 900, fontSize: 34, margin: '0 0 6px', lineHeight: 1, ...F }}>
        {value}
      </p>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend.up
            ? <ArrowUpRight size={13} color={primary ? T.textInv : T.green} />
            : <ArrowDownRight size={13} color={primary ? T.textInv : T.red} />
          }
          <span style={{ fontSize: 11, fontWeight: 600, color: primary ? T.textInv + 'bb' : (trend.up ? T.green : T.red) }}>
            {trend.label}
          </span>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────── BARBER CARD (horizontal) ─────────────────────── */
function BarberRow({ barber, isFav, onToggleFav, onBook }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        background: hov ? T.bgHover : T.bgCard, border: `1px solid ${T.border}`,
        borderRadius: 18, transition: 'background 0.15s', cursor: 'pointer',
      }}>
      <Avatar src={barber.photoURL} name={barber.name} size={48} radius={14} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
          <p style={{ color: T.textPri, fontWeight: 700, fontSize: 15, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {barber.name}
          </p>
          {isFav && <Star size={12} color={T.yellow} fill={T.yellow} />}
        </div>
        {barber.address && (
          <p style={{ color: T.textSec, fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={10} />{barber.address}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={e => { e.stopPropagation(); onToggleFav() }} style={{
          background: isFav ? T.yellowDim : T.bgRaised, border: `1px solid ${isFav ? T.yellow + '44' : T.border}`,
          borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: isFav ? T.yellow : T.textTert, transition: 'all 0.2s',
        }}>
          <Star size={15} fill={isFav ? T.yellow : 'none'} />
        </button>
        <button onClick={e => { e.stopPropagation(); onBook() }} style={{
          background: T.yellow, border: 'none', borderRadius: 10, padding: '0 16px',
          height: 36, color: T.textInv, fontWeight: 700, fontSize: 13, cursor: 'pointer', ...F,
          transition: 'opacity 0.15s',
        }}>
          Book
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────── FAVORITE CARD (compact vertical) ─────────────── */
function FavCard({ barber, isFav, onToggleFav, onBook }) {
  return (
    <div style={{
      flexShrink: 0, width: 130, background: T.bgCard, border: `1px solid ${T.border}`,
      borderRadius: 20, padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      <div style={{ position: 'relative' }}>
        <Avatar src={barber.photoURL} name={barber.name} size={54} radius={16} border={`2px solid ${T.yellow}44`} />
        <button onClick={onToggleFav} style={{
          position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
          background: T.bgRaised, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', color: T.yellow,
        }}>
          <Star size={11} fill={T.yellow} />
        </button>
      </div>
      <p style={{ color: T.textPri, fontWeight: 700, fontSize: 13, margin: 0, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
        {barber.name}
      </p>
      <button onClick={onBook} style={{
        width: '100%', background: T.yellow, border: 'none', borderRadius: 10, padding: '8px 0',
        color: T.textInv, fontWeight: 700, fontSize: 12, cursor: 'pointer', ...F,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      }}>
        <Scissors size={11} /> Book Again
      </button>
    </div>
  )
}

/* ─────────────────────── APPOINTMENT CARD ──────────────────────────────── */
function ApptCard({ appt, onCancel, formatTime }) {
  const sc = statusColor(appt.bookingStatus)
  const isPast = !['cancelled'].includes(appt.bookingStatus) && (() => {
    const [y, m, d] = (appt.date || '').split('-').map(Number)
    const [h, mn] = (appt.endTime || '00:00').split(':').map(Number)
    return new Date(y, m - 1, d, h, mn) < new Date()
  })()

  return (
    <div style={{
      background: T.bgCard, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${sc}`, borderRadius: 16,
      padding: '14px 16px', opacity: appt.bookingStatus === 'cancelled' ? 0.5 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <p style={{ color: T.textPri, fontWeight: 700, fontSize: 15, margin: '0 0 3px' }}>{appt.barberName}</p>
          <p style={{ color: T.textSec, fontSize: 13, margin: 0 }}>
            {appt.date ? format(parseLocalDate(appt.date), 'EEE, MMM d') : '—'} · {formatTime ? formatTime(appt.startTime) : appt.startTime}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: T.yellow, fontWeight: 900, fontSize: 16, margin: '0 0 4px' }}>{formatCurrency(appt.totalPrice)}</p>
          <Pill label={appt.bookingStatus} color={sc} />
        </div>
      </div>
      {appt.services?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {appt.services.map((s, i) => <Pill key={i} label={s.name} color={T.textSec} bg={T.bgRaised} />)}
        </div>
      )}
      {onCancel && appt.bookingStatus !== 'cancelled' && !isPast && (
        <button onClick={onCancel} style={{
          background: T.redDim, border: `1px solid ${T.red}33`,
          borderRadius: 8, padding: '5px 14px', color: T.red,
          fontSize: 12, fontWeight: 700, cursor: 'pointer', ...F,
        }}>Cancel</button>
      )}
    </div>
  )
}

/* ─────────────────────── AVAILABILITY CALENDAR ─────────────────────────── */
function AvailCalendar({ barber, onClose, onSelectSlot }) {
  const [month, setMonth] = useState(new Date())
  const [selDay, setSelDay] = useState(null)
  const [avail, setAvail] = useState(null)
  const [barberAppts, setBarberAppts] = useState([])
  const [slots, setSlots] = useState([])
  const [selSlot, setSelSlot] = useState(null)
  const today = startOfDay(new Date())

  useEffect(() => {
    if (!barber) return
    Promise.all([
      getDocs(query(collection(db, 'availability'), where('barberId', '==', barber.id))),
      getDocs(query(collection(db, 'appointments'), where('barberId', '==', barber.id), where('bookingStatus', '!=', 'cancelled'))),
    ]).then(([aS, bS]) => {
      if (!aS.empty) setAvail(aS.docs[0].data())
      setBarberAppts(bS.docs.map(d => d.data()))
    })
  }, [barber])

  useEffect(() => {
    if (!selDay || !avail) { setSlots([]); return }
    const di = selDay.getDay()
    const ds = avail.schedule?.[di] || { enabled: (avail.workingDays || [1, 2, 3, 4, 5, 6]).includes(di), startTime: avail.startTime || '09:00', endTime: avail.endTime || '18:00', breaks: avail.breaks || [] }
    if (!ds.enabled) { setSlots([]); return }
    const dateStr = format(selDay, 'yyyy-MM-dd')
    const existing = barberAppts.filter(a => a.date === dateStr).map(a => ({ startTime: a.startTime, endTime: a.endTime }))
    let s = generateTimeSlots(ds.startTime, ds.endTime, 30, ds.breaks || [], existing)
    if (isToday(selDay)) { const nm = new Date().getHours() * 60 + new Date().getMinutes() + 15; s = s.filter(sl => { const [h, m] = sl.startTime.split(':').map(Number); return h * 60 + m > nm }) }
    setSlots(s); setSelSlot(null)
  }, [selDay, avail, barberAppts])

  const calDays = eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) })

  function isOpen(date) {
    if (!avail || date < today) return false
    const di = date.getDay()
    const ds = avail.schedule?.[di] || { enabled: (avail.workingDays || [1, 2, 3, 4, 5, 6]).includes(di) }
    if (!ds.enabled) return false
    if (avail.blockedDates?.includes(format(date, 'yyyy-MM-dd'))) return false
    return true
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 520, background: T.bgCard, borderRadius: '28px 28px 0 0', border: `1px solid ${T.border}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', ...F }} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: T.borderHigh }} />
        </div>
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: T.textSec, fontSize: 11, margin: '0 0 2px' }}>AVAILABILITY</p>
            <p style={{ color: T.textPri, fontWeight: 800, fontSize: 17, margin: 0 }}>{barber?.name}</p>
          </div>
          <button onClick={onClose} style={{ background: T.bgRaised, border: `1px solid ${T.border}`, borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textSec }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '18px 20px' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button onClick={() => setMonth(m => subMonths(m, 1))} style={{ background: T.bgRaised, border: `1px solid ${T.border}`, borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textPri }}><ChevronLeft size={17} /></button>
            <p style={{ color: T.textPri, fontWeight: 800, fontSize: 16, margin: 0 }}>{format(month, 'MMMM yyyy')}</p>
            <button onClick={() => setMonth(m => addMonths(m, 1))} style={{ background: T.bgRaised, border: `1px solid ${T.border}`, borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textPri }}><ChevronRight size={17} /></button>
          </div>

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 8 }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: T.textTert, padding: '3px 0' }}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 24 }}>
            {calDays.map((date, i) => {
              const inM = isSameMonth(date, month)
              const past = date < today
              const isSel = selDay && isSameDay(date, selDay)
              const isT = isToday(date)
              const open = isOpen(date)
              return (
                <button key={i} onClick={() => { if (!inM || past || !open) return; setSelDay(date) }}
                  style={{
                    padding: '8px 2px', borderRadius: 10, border: 'none', cursor: (!inM || past || !open) ? 'default' : 'pointer',
                    background: isSel ? T.yellow : isT ? T.yellowDim : 'transparent',
                    opacity: !inM ? 0.12 : past ? 0.25 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'background 0.15s',
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isSel ? T.textInv : isT ? T.yellow : T.textPri }}>
                    {date.getDate()}
                  </span>
                  {inM && !past && open && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: isSel ? T.textInv + '88' : T.green }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Time slots */}
          {selDay && (
            <div>
              <p style={{ color: T.textSec, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>
                {format(selDay, 'EEEE, MMMM d').toUpperCase()}
              </p>
              {slots.length === 0
                ? <p style={{ color: T.textSec, textAlign: 'center', padding: '20px 0', fontSize: 14 }}>No available times this day</p>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
                  {slots.map(slot => {
                    const sel = selSlot?.startTime === slot.startTime
                    return (
                      <button key={slot.startTime} onClick={() => setSelSlot(slot)}
                        style={{
                          padding: '12px 4px', borderRadius: 12, border: `1.5px solid ${sel ? T.yellow : T.border}`,
                          background: sel ? T.yellow : T.bgRaised, color: sel ? T.textInv : T.textPri,
                          fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s', ...F,
                          boxShadow: sel ? T.yellowGlow : 'none',
                        }}>
                        {slot.startTime}
                      </button>
                    )
                  })}
                </div>
              }
              {selSlot && (
                <button onClick={() => onSelectSlot(selDay, selSlot, barber)}
                  style={{
                    width: '100%', background: T.yellow, border: 'none', borderRadius: 16, padding: '17px',
                    color: T.textInv, fontWeight: 800, fontSize: 16, cursor: 'pointer', ...F,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: T.yellowGlow,
                  }}>
                  <Scissors size={18} />
                  Book {selSlot.startTime} · {format(selDay, 'MMM d')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────── MODAL SHELL ───────────────────────────────────── */
function Sheet({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }} onClick={onClose}>
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 24, padding: 22, width: '100%', maxWidth: 360, ...F }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/* ─────────────────────── NOTIFICATIONS PANEL ───────────────────────────── */
function NotifsPanel({ userId, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const icon = { broadcast: '📢', reschedule: '📅', cancel: '❌', booking: '✅', system: 'ℹ️' }

  useEffect(() => {
    if (!userId) return
    getDocs(query(collection(db, 'notifications'), where('userId', '==', userId)))
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        setItems(all); setLoading(false)
        snap.docs.filter(d => !d.data().read).forEach(d => updateDoc(doc(db, 'notifications', d.id), { read: true }))
      })
  }, [userId])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.88)' }} onClick={onClose}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: Math.min(340, window.innerWidth), background: T.bgCard, borderLeft: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', ...F }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: T.textPri, fontWeight: 800, fontSize: 17, margin: 0 }}>Notifications</p>
          <button onClick={onClose} style={{ background: T.bgRaised, border: `1px solid ${T.border}`, borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textSec }}><X size={15} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Bell size={32} style={{ color: T.textTert, margin: '0 auto 12px', display: 'block' }} />
              <p style={{ color: T.textSec, fontSize: 14 }}>All caught up</p>
            </div>
          ) : items.map(n => (
            <div key={n.id} style={{ background: n.read ? T.bgRaised : T.yellowDim, border: `1px solid ${n.read ? T.border : T.yellow + '33'}`, borderRadius: 14, padding: '12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon[n.type] || 'ℹ️'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: T.textPri, fontWeight: 700, fontSize: 13, margin: '0 0 3px' }}>{n.title}</p>
                  <p style={{ color: T.textSec, fontSize: 12, margin: 0, lineHeight: 1.5 }}>{n.message}</p>
                  <p style={{ color: T.textTert, fontSize: 10, margin: '5px 0 0' }}>
                    {n.createdAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════ MAIN DASHBOARD ═══════════════════════════════════ */
export default function ClientDashboard() {
  const { barberSlug } = useParams()
  const { user, userData, signOut, refreshUserData } = useAuth()
  const { formatTime } = useTheme()
  const navigate = useNavigate()

  const [tab, setTab]           = useState('home')
  const [appts, setAppts]       = useState([])
  const [barbers, setBarbers]   = useState([])
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showNotifs, setShowNotifs] = useState(false)
  const [calBarber, setCalBarber] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const photoRef = useRef(null)
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '', photoURL: '' })
  const [saving, setSaving] = useState(false)
  const refreshRef = useRef(null)

  async function loadFavs(uid) {
    try {
      const s = await getDoc(doc(db, 'userPrefs', uid))
      if (s.exists()) setFavorites(s.data().favoriteBarbers || [])
    } catch {}
  }

  async function toggleFav(barberId) {
    if (!user) return
    const next = favorites.includes(barberId) ? favorites.filter(id => id !== barberId) : [...favorites, barberId]
    setFavorites(next)
    try { await setDoc(doc(db, 'userPrefs', user.uid), { favoriteBarbers: next }, { merge: true }) } catch {}
  }

  async function loadAll() {
    if (!user) return
    const [aSnap, bSnap] = await Promise.all([
      getDocs(query(collection(db, 'appointments'), where('clientId', '==', user.uid))),
      getDocs(collection(db, 'barbers')),
    ])
    setAppts(aSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    setBarbers(bSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.isActive !== false))
    setLoading(false)
  }

  useEffect(() => {
    if (!user) { navigate(`/b/${barberSlug}/auth`); return }
    if (userData) setProfileForm({ firstName: userData.firstName || '', lastName: userData.lastName || '', phone: userData.phone || '', photoURL: userData.photoURL || '' })
    loadAll(); loadFavs(user.uid)
    refreshRef.current = setInterval(loadAll, 22000)
    return () => clearInterval(refreshRef.current)
  }, [user, userData])

  // Computed
  const upcoming = appts.filter(a => {
    if (a.bookingStatus === 'cancelled') return false
    const [y, m, d] = (a.date || '').split('-').map(Number)
    const [h, mn] = (a.startTime || '00:00').split(':').map(Number)
    return new Date(y, m - 1, d, h, mn) > new Date()
  }).sort((a, b) => a.date?.localeCompare(b.date) || a.startTime?.localeCompare(b.startTime))

  const history = appts.filter(a => {
    if (a.bookingStatus === 'cancelled') return true
    const [y, m, d] = (a.date || '').split('-').map(Number)
    const [h, mn] = (a.startTime || '00:00').split(':').map(Number)
    return new Date(y, m - 1, d, h, mn) <= new Date()
  })

  const thisMonth  = format(new Date(), 'yyyy-MM')
  const cancelledN = appts.filter(a => a.date?.startsWith(thisMonth) && a.bookingStatus === 'cancelled').length
  const totalM     = appts.filter(a => a.date?.startsWith(thisMonth)).length
  const cancelRate = totalM > 0 ? `${Math.round(cancelledN / totalM * 100)}%` : '0%'
  const totalVisits = userData?.totalVisits || history.filter(a => a.bookingStatus === 'completed').length
  const totalSpent  = appts.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.totalPrice || 0), 0)

  const sortedBarbers = [...barbers].sort((a, b) => {
    if (favorites.includes(a.id) && !favorites.includes(b.id)) return -1
    if (!favorites.includes(a.id) && favorites.includes(b.id)) return 1
    return 0
  })
  const favBarbers  = sortedBarbers.filter(b => favorites.includes(b.id))

  function bookBarber(barber) { navigate(`/b/${barber.slug || barberSlug}/book`) }

  async function handleCancel() {
    if (!cancelTarget) return
    await updateDoc(doc(db, 'appointments', cancelTarget), { bookingStatus: 'cancelled', paymentStatus: 'cancelled' })
    setAppts(p => p.map(a => a.id === cancelTarget ? { ...a, bookingStatus: 'cancelled', paymentStatus: 'cancelled' } : a))
    toast.success('Appointment cancelled'); setCancelTarget(null)
  }

  const TABS = [
    { id: 'home',     Icon: Home,          label: 'Home'     },
    { id: 'calendar', Icon: CalendarDays,  label: 'Calendar' },
    { id: 'bookings', Icon: ClipboardList, label: 'Bookings' },
    { id: 'profile',  Icon: User,          label: 'Profile'  },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size={30} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  /* ── HOME TAB ─────────────────────────────────────────────────────────── */
  const HomeTab = () => {
    const next = upcoming[0]
    return (
      <div style={{ padding: '0 0 24px' }}>
        {/* Header */}
        <div style={{ padding: '52px 20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: T.textSec, fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
              {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
            </p>
            <h1 style={{ color: T.textPri, fontWeight: 900, fontSize: 30, margin: 0, lineHeight: 1.05, letterSpacing: '-0.5px' }}>
              {userData?.firstName || 'Hey there'}
            </h1>
          </div>
          <NotifBell userId={user?.uid} onOpen={() => setShowNotifs(true)} />
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'flex', gap: 10, padding: '0 20px', marginBottom: 32 }}>
          <StatCard label="Upcoming" value={upcoming.length} primary trend={{ up: true, label: `${totalVisits} total visits` }} />
          <StatCard label="Cancelled this month" value={cancelRate} trend={{ up: false, label: `${cancelledN} appointment${cancelledN !== 1 ? 's' : ''}` }} />
        </div>

        {/* Favorite Barbers */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={16} color={T.yellow} fill={T.yellow} />
              <p style={{ color: T.textPri, fontWeight: 800, fontSize: 18, margin: 0 }}>Favorites</p>
            </div>
            {favBarbers.length === 0 && <p style={{ color: T.textTert, fontSize: 12 }}>Tap ★ to add</p>}
          </div>

          {favBarbers.length === 0 ? (
            <div style={{ margin: '0 20px', background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 18, padding: '24px', textAlign: 'center' }}>
              <Star size={30} style={{ color: T.textTert, margin: '0 auto 10px', display: 'block' }} />
              <p style={{ color: T.textSec, fontSize: 14, margin: 0 }}>No favorites yet</p>
              <p style={{ color: T.textTert, fontSize: 12, margin: '4px 0 0' }}>Star a barber below to add them here</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, padding: '0 20px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {favBarbers.map(b => (
                <FavCard key={b.id} barber={b} isFav onToggleFav={() => toggleFav(b.id)} onBook={() => bookBarber(b)} />
              ))}
            </div>
          )}
        </div>

        {/* Next Appointment */}
        {next && (
          <div style={{ padding: '0 20px', marginBottom: 32 }}>
            <p style={{ color: T.textSec, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12 }}>NEXT APPOINTMENT</p>
            <div style={{ background: T.yellowDim, border: `1.5px solid ${T.yellow}44`, borderRadius: 22, padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ color: T.textPri, fontWeight: 800, fontSize: 17, margin: '0 0 3px' }}>{next.barberName}</p>
                  <p style={{ color: T.yellow, fontWeight: 700, fontSize: 14, margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={13} />{next.date ? format(parseLocalDate(next.date), 'EEE, MMM d') : '—'} · {formatTime ? formatTime(next.startTime) : next.startTime}
                  </p>
                  <p style={{ color: T.textSec, fontSize: 12, margin: 0 }}>{formatDuration(next.totalDuration)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: T.yellow, fontWeight: 900, fontSize: 22, margin: '0 0 4px' }}>{formatCurrency(next.totalPrice)}</p>
                  <Pill label={
                    differenceInDays(new Date(`${next.date}T${next.startTime}`), new Date()) === 0 ? 'Today'
                      : isTomorrow(parseLocalDate(next.date)) ? 'Tomorrow'
                      : `${differenceInDays(new Date(`${next.date}T${next.startTime}`), new Date())} days`
                  } color={T.green} />
                </div>
              </div>
              {next.services?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {next.services.map((s, i) => <Pill key={i} label={s.name} color={T.textSec} bg={T.bgCard} />)}
                </div>
              )}
              <button onClick={() => setCancelTarget(next.id)}
                style={{ background: T.redDim, border: `1px solid ${T.red}33`, borderRadius: 10, padding: '8px 16px', color: T.red, fontWeight: 700, fontSize: 13, cursor: 'pointer', ...F }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* All Barbers */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ color: T.textPri, fontWeight: 800, fontSize: 18, margin: 0 }}>Barbers</p>
            <button onClick={() => setTab('calendar')} style={{ color: T.yellow, fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', ...F, display: 'flex', alignItems: 'center', gap: 4 }}>
              View All <ChevronRight size={15} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedBarbers.slice(0, 5).map(b => (
              <BarberRow key={b.id} barber={b} isFav={favorites.includes(b.id)} onToggleFav={() => toggleFav(b.id)} onBook={() => setCalBarber(b)} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── CALENDAR TAB ─────────────────────────────────────────────────────── */
  const CalendarTab = () => (
    <div style={{ padding: '52px 20px 20px' }}>
      <h2 style={{ color: T.textPri, fontWeight: 900, fontSize: 26, margin: '0 0 4px', letterSpacing: '-0.4px' }}>Schedule</h2>
      <p style={{ color: T.textSec, fontSize: 14, margin: '0 0 24px' }}>Pick a barber to see availability</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sortedBarbers.map(b => (
          <div key={b.id} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 20, padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar src={b.photoURL} name={b.name} size={52} radius={15} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <p style={{ color: T.textPri, fontWeight: 700, fontSize: 15, margin: 0 }}>{b.name}</p>
                {favorites.includes(b.id) && <Star size={13} color={T.yellow} fill={T.yellow} />}
              </div>
              {b.address && <p style={{ color: T.textSec, fontSize: 12, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={10} />{b.address}</p>}
              {b.bio && <p style={{ color: T.textTert, fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.bio}</p>}
            </div>
            <button onClick={() => setCalBarber(b)}
              style={{ background: T.yellow, border: 'none', borderRadius: 14, padding: '12px 18px', color: T.textInv, fontWeight: 700, fontSize: 14, cursor: 'pointer', ...F, flexShrink: 0 }}>
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  /* ── BOOKINGS TAB ─────────────────────────────────────────────────────── */
  const BookingsTab = () => (
    <div style={{ padding: '52px 20px 20px' }}>
      <h2 style={{ color: T.textPri, fontWeight: 900, fontSize: 26, margin: '0 0 20px', letterSpacing: '-0.4px' }}>My Bookings</h2>
      {appts.length === 0 ? (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 22, padding: '40px 20px', textAlign: 'center' }}>
          <ClipboardList size={36} style={{ color: T.textTert, margin: '0 auto 14px', display: 'block' }} />
          <p style={{ color: T.textSec, fontSize: 15, margin: '0 0 16px' }}>No bookings yet</p>
          <button onClick={() => setTab('calendar')} style={{ background: T.yellow, border: 'none', borderRadius: 14, padding: '12px 28px', color: T.textInv, fontWeight: 700, fontSize: 15, cursor: 'pointer', ...F }}>
            Book Now
          </button>
        </div>
      ) : (<>
        {upcoming.length > 0 && <>
          <p style={{ color: T.textSec, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12 }}>UPCOMING</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {upcoming.map(a => <ApptCard key={a.id} appt={a} onCancel={() => setCancelTarget(a.id)} formatTime={formatTime} />)}
          </div>
        </>}
        {history.length > 0 && <>
          <p style={{ color: T.textSec, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12 }}>HISTORY</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map(a => <ApptCard key={a.id} appt={a} formatTime={formatTime} />)}
          </div>
        </>}
      </>)}
    </div>
  )

  /* ── PROFILE TAB ──────────────────────────────────────────────────────── */
  const ProfileTab = () => {
    const { theme, toggleTheme, timeFormat, setTimeFormat, accent, setAccent, accents } = useTheme()
    return (
      <div style={{ padding: '52px 20px 20px' }}>
        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }} onClick={() => photoRef.current?.click()}>
            <Avatar src={profileForm.photoURL} name={`${profileForm.firstName} ${profileForm.lastName}`} size={88} radius={26} border={`2.5px solid ${T.yellow}55`} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: T.yellow, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${T.bg}` }}>
              <Plus size={14} color={T.textInv} />
            </div>
          </div>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return
            const reader = new FileReader(); reader.onload = ev => setProfileForm(p => ({ ...p, photoURL: ev.target.result })); reader.readAsDataURL(file)
            try { const path = sRef(storage, `profiles/${user.uid}/photo_${Date.now()}`); const snap = await uploadBytes(path, file); const url = await getDownloadURL(snap.ref); setProfileForm(p => ({ ...p, photoURL: url })) } catch {}
          }} />
          <p style={{ color: T.textPri, fontWeight: 800, fontSize: 20, margin: '12px 0 2px' }}>{profileForm.firstName} {profileForm.lastName}</p>
          <p style={{ color: T.textSec, fontSize: 14, margin: 0 }}>{user?.email}</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <StatCard label="Total visits" value={totalVisits} />
          <StatCard label="Total spent" value={formatCurrency(totalSpent)} />
        </div>

        {/* Edit Profile */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 22, padding: '18px', marginBottom: 14 }}>
          <p style={{ color: T.textSec, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 16 }}>PERSONAL INFO</p>
          {[['First Name', 'firstName', 'text'], ['Last Name', 'lastName', 'text']].map(([lbl, key, type]) => (
            <div key={key} style={{ marginBottom: 18 }}>
              <p style={{ color: T.textTert, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 7 }}>{lbl.toUpperCase()}</p>
              <div style={{ borderBottom: `1.5px solid ${T.border}`, paddingBottom: 8 }}>
                <input type={type} value={profileForm[key] || ''} onChange={e => { const v = e.target.value; setProfileForm(p => ({ ...p, [key]: v })) }} autoComplete="off"
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: T.textPri, fontSize: 16, ...F }} />
              </div>
            </div>
          ))}
          <button onClick={async () => {
            setSaving(true)
            try { await updateDoc(doc(db, 'users', user.uid), profileForm); await refreshUserData(); toast.success('Saved!') }
            catch { toast.error('Failed to save') } finally { setSaving(false) }
          }} disabled={saving}
            style={{ width: '100%', background: T.yellow, border: 'none', borderRadius: 14, padding: '15px', color: T.textInv, fontWeight: 800, fontSize: 15, cursor: 'pointer', ...F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: T.yellowGlow }}>
            {saving && <Spin size={16} color={T.textInv} />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Appearance */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 22, padding: '18px', marginBottom: 14 }}>
          <p style={{ color: T.textSec, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 16 }}>APPEARANCE</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ color: T.textPri, fontWeight: 700, fontSize: 14, margin: 0 }}>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</p>
            <button onClick={toggleTheme} style={{ width: 52, height: 28, borderRadius: 14, padding: 3, border: 'none', cursor: 'pointer', background: theme === 'dark' ? T.yellow : T.borderHigh, display: 'flex', alignItems: 'center', justifyContent: theme === 'dark' ? 'flex-end' : 'flex-start', transition: 'background 0.2s' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
            </button>
          </div>
          <p style={{ color: T.textSec, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>TIME FORMAT</p>
          <div style={{ display: 'flex', background: T.bgRaised, borderRadius: 12, padding: 3, border: `1px solid ${T.border}` }}>
            {[['12h', '12h (AM/PM)'], ['24h', '24h']].map(([val, lbl]) => (
              <button key={val} onClick={() => setTimeFormat(val)}
                style={{ flex: 1, padding: '9px', borderRadius: 10, fontWeight: 700, fontSize: 13, background: timeFormat === val ? T.yellow : 'transparent', color: timeFormat === val ? T.textInv : T.textSec, border: 'none', cursor: 'pointer', ...F, transition: 'all 0.15s' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <button onClick={async () => { await signOut(); navigate(`/b/${barberSlug}`) }}
          style={{ width: '100%', background: 'none', border: `1px solid ${T.border}`, borderRadius: 16, padding: '15px', color: T.red, fontWeight: 700, fontSize: 15, cursor: 'pointer', ...F }}>
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.textPri, ...F, paddingBottom: 76 }}>
      <ImportantMessagePopup userId={user?.uid} />

      {/* Tab content */}
      {tab === 'home'     && <HomeTab />}
      {tab === 'calendar' && <CalendarTab />}
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'profile'  && <ProfileTab />}

      {/* ── Bottom Nav ─────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: T.bgCard, borderTop: `1px solid ${T.border}`,
        display: 'flex', paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        backdropFilter: 'blur(16px)', zIndex: 50,
      }}>
        {TABS.map(({ id, Icon, label }) => {
          const active = tab === id
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '11px 0', color: active ? T.yellow : T.textTert,
              transition: 'color 0.2s', ...F, position: 'relative',
            }}>
              {active && (
                <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, background: T.yellow, borderRadius: '0 0 3px 3px', boxShadow: T.yellowGlow }} />
              )}
              <Icon size={21} strokeWidth={active ? 2.5 : 1.5} />
              <span style={{ fontSize: 10, fontWeight: active ? 800 : 500, letterSpacing: '0.04em' }}>{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Modals */}
      {cancelTarget && (
        <Sheet onClose={() => setCancelTarget(null)}>
          <p style={{ color: T.textPri, fontWeight: 900, fontSize: 19, marginBottom: 8 }}>Cancel appointment?</p>
          <p style={{ color: T.textSec, fontSize: 14, marginBottom: 22 }}>This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setCancelTarget(null)} style={{ flex: 1, padding: '14px', borderRadius: 14, background: T.bgRaised, color: T.textSec, fontWeight: 700, border: `1px solid ${T.border}`, cursor: 'pointer', ...F }}>Keep</button>
            <button onClick={handleCancel} style={{ flex: 1, padding: '14px', borderRadius: 14, background: T.redDim, color: T.red, fontWeight: 700, border: `1px solid ${T.red}44`, cursor: 'pointer', ...F }}>Cancel</button>
          </div>
        </Sheet>
      )}

      {calBarber && (
        <AvailCalendar
          barber={calBarber}
          onClose={() => setCalBarber(null)}
          onSelectSlot={(day, slot, barber) => { navigate(`/b/${barber.slug || barberSlug}/book`) }}
        />
      )}

      {showNotifs && <NotifsPanel userId={user?.uid} onClose={() => setShowNotifs(false)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        body { background: ${T.bg} !important; }
      `}</style>
    </div>
  )
}
