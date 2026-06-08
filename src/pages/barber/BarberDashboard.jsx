/**
 * BarberDashboard — Migrado al nuevo design system
 * ✅ Todos los colores usan var(--token) — light/dark automático
 * ✅ Layout del mockup: greeting, stats, próxima cita, acciones rápidas, actividad
 * ✅ Lógica Firebase/hooks intacta
 * ✅ Modales con variables de tema
 */
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, formatDuration, parseLocalDate, generateTimeSlots } from '../../utils/helpers'
import { format, isToday, isTomorrow, differenceInSeconds, startOfDay, addDays, isSameDay } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import {
  X, Scissors, Phone, Mail, Plus, ChevronRight, TrendingUp,
  Check, ChevronLeft, Search, User, CheckCircle,
  XCircle, AlertCircle, CalendarPlus, DollarSign,
  Calendar, Users, BarChart2, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────
function apptEnd(a)   { const [y,m,d]=a.date.split('-').map(Number),[h,mn]=a.endTime.split(':').map(Number);   return new Date(y,m-1,d,h,mn) }
function apptStart(a) { const [y,m,d]=a.date.split('-').map(Number),[h,mn]=a.startTime.split(':').map(Number); return new Date(y,m-1,d,h,mn) }

// ── Avatar ────────────────────────────────────────────────────────────────
function Av({ name, photoURL, size=36, fontSize=12, ring=false }) {
  const i = name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || '?'
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', overflow:'hidden', flexShrink:0,
      background:'var(--card2)',
      border: `2px solid ${ring ? 'var(--accent)' : 'var(--border)'}`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:800, fontSize, color:'var(--text-sec)',
    }}>
      {photoURL ? <img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : i}
    </div>
  )
}

// ── Walk-in badge ─────────────────────────────────────────────────────────
function WBadge() {
  return (
    <span style={{ background:'var(--purple-soft)', color:'var(--purple)', fontSize:8, fontWeight:800, padding:'1px 6px', borderRadius:7, flexShrink:0 }}>
      W
    </span>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────
function SBadge({ status, paid }) {
  if (status === 'completed') return (
    <span style={{ background: paid ? 'var(--green-soft)' : 'var(--card3)', color: paid ? 'var(--green)' : 'var(--text-sec)', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20, whiteSpace:'nowrap' }}>
      {paid ? 'Pagado' : 'Listo'}
    </span>
  )
  const map = {
    confirmed: { bg:'var(--green-soft)',  c:'var(--green)',  l:'Confirmado' },
    pending:   { bg:'var(--accent-soft)', c:'var(--accent)', l:'Pendiente'  },
    cancelled: { bg:'var(--red-soft)',    c:'var(--red)',    l:'Cancelado'  },
  }
  const s = map[status] || map.pending
  return <span style={{ background:s.bg, color:s.c, fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20, whiteSpace:'nowrap' }}>{s.l}</span>
}

// ── Circular countdown (Now Serving card) ─────────────────────────────────
function CircularCountdown({ appt }) {
  const [info, setInfo] = useState({ text:'0:00', pct:1 })
  useEffect(() => {
    function tick() {
      const s=apptStart(appt), e=apptEnd(appt), n=new Date()
      if (n>e) { setInfo({text:'0:00',pct:0}); return }
      const total=differenceInSeconds(e,s), rem=Math.max(0,differenceInSeconds(e,n))
      const pct=rem/total, m=Math.floor(rem/60), sc=rem%60
      setInfo({ text:`${m}:${String(sc).padStart(2,'0')}`, pct })
    }
    tick(); const iv=setInterval(tick,1000); return ()=>clearInterval(iv)
  }, [appt])
  const r=24, size=58, stroke=4, cx=size/2, cy=size/2
  const circ=2*Math.PI*r, offset=circ*(1-info.pct)
  const col = info.pct>0.5 ? 'rgba(255,255,255,0.95)' : info.pct>0.25 ? '#FFD060' : '#FF6B6B'
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={stroke}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset 0.8s ease, stroke 0.8s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:1 }}>
        <span style={{ color:'#fff', fontWeight:800, fontSize:9, fontVariantNumeric:'tabular-nums', lineHeight:1 }}>{info.text}</span>
        <span style={{ color:'rgba(255,255,255,0.55)', fontSize:7, fontWeight:600, lineHeight:1 }}>left</span>
      </div>
    </div>
  )
}

// ── Next up countdown card ────────────────────────────────────────────────
function NextUpCard({ next, onClick, formatTime }) {
  const [bcolor, setBcolor] = useState('var(--green)')
  const [secs,   setSecs]   = useState(null)
  useEffect(() => {
    function tick() {
      const s=apptStart(next), n=new Date()
      const d=Math.max(0,differenceInSeconds(s,n))
      setSecs(d)
      setBcolor(d>20*60 ? 'var(--green)' : d>10*60 ? 'var(--accent)' : 'var(--red)')
    }
    tick(); const iv=setInterval(tick,1000); return ()=>clearInterval(iv)
  }, [next])

  const ct = secs !== null
    ? secs>=3600 ? `en ${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`
    : secs>=60   ? `en ${Math.floor(secs/60)}m`
    : `en ${secs}s`
    : ''

  return (
    <button onClick={onClick}
      style={{
        width:'100%', textAlign:'left', cursor:'pointer', fontFamily:'inherit',
        background:'var(--card)', border:`1px solid var(--border)`,
        borderLeft:`3px solid ${bcolor}`, borderRadius:14,
        padding:'12px 14px', marginBottom:10,
        boxShadow:'var(--shadow)',
      }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <div style={{ width:5, height:5, borderRadius:'50%', background:bcolor, animation:'pulse 2s infinite' }}/>
        <span style={{ color:bcolor, fontSize:9, fontWeight:800, letterSpacing:'0.1em' }}>PRÓXIMA CITA</span>
        <div style={{ flex:1 }}/>
        <span style={{ color:bcolor, fontSize:11, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{ct}</span>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ minWidth:0, flex:1 }}>
          <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{next.clientName}</p>
          <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{formatTime(next.startTime)} · {next.services?.map(s=>s.name).join(', ')}</p>
        </div>
        <p style={{ color:bcolor, fontWeight:800, fontSize:14, margin:'0 0 0 12px', flexShrink:0 }}>{formatCurrency(next.totalPrice)}</p>
      </div>
    </button>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────
function Modal({ children, onClose, maxW=420 }) {
  return (
    <div className="fade-in"
      style={{ position:'fixed', inset:0, zIndex:80, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div className="slide-up"
        style={{ width:'100%', maxWidth:maxW, background:'var(--surface)', borderRadius:20, border:'1px solid var(--border)', maxHeight:'88dvh', overflowY:'auto', boxShadow:'var(--shadow-lg)', fontFamily:'inherit' }}
        onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ── Appointment detail modal ──────────────────────────────────────────────
function ApptModal({ appt, allAppts, onClose }) {
  const { formatTime } = useTheme()
  const [tip,    setTip]    = useState(appt.tip||0)
  const [pay,    setPay]    = useState(appt.paymentMethod||'cash')
  const [saving, setSaving] = useState(false)

  const related = allAppts.filter(a => appt.clientId ? a.clientId===appt.clientId : a.clientName===appt.clientName)
  const visits  = related.filter(a=>a.bookingStatus==='completed').length
  const spent   = related.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const total   = (appt.totalPrice||0) + (+tip||0)

  async function save(s2, p2) {
    setSaving(true)
    try {
      await updateDoc(doc(db,'appointments',appt.id), {
        bookingStatus:  s2 || appt.bookingStatus,
        paymentStatus:  p2 || appt.paymentStatus,
        tip:            +tip||0,
        totalWithTip:   total,
        paymentMethod:  pay,
        updatedAt:      serverTimestamp(),
      })
      toast.success('Actualizado ✓')
      onClose()
    } catch { toast.error('Error al guardar') }
    setSaving(false)
  }

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Av name={appt.clientName} photoURL={appt.clientPhotoURL} size={38} fontSize={12}/>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:0 }}>{appt.clientName}</p>
              {appt.isWalkIn && <WBadge/>}
            </div>
            <SBadge status={appt.bookingStatus} paid={appt.paymentStatus==='paid'}/>
          </div>
        </div>
        <button onClick={onClose}
          style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 7px', color:'var(--text-sec)', cursor:'pointer', display:'flex' }}>
          <X size={14}/>
        </button>
      </div>

      <div style={{ padding:'14px 16px 20px' }}>
        {/* Contact */}
        {(appt.clientEmail || appt.clientPhone) && (
          <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:12 }}>
            {appt.clientEmail && (
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--card2)', borderRadius:8, padding:'7px 10px' }}>
                <Mail size={12} color="var(--text-ter)"/>
                <span style={{ color:'var(--text-sec)', fontSize:12 }}>{appt.clientEmail}</span>
              </div>
            )}
            {appt.clientPhone && (
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--card2)', borderRadius:8, padding:'7px 10px' }}>
                <Phone size={12} color="var(--text-ter)"/>
                <a href={`tel:${appt.clientPhone}`} style={{ color:'var(--accent)', fontSize:12, textDecoration:'none', fontWeight:600 }}>{appt.clientPhone}</a>
              </div>
            )}
          </div>
        )}

        {/* Services */}
        <div style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 13px', marginBottom:10 }}>
          {appt.services?.map((s,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:i<appt.services.length-1?'1px solid var(--border)':'none' }}>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:600, fontSize:13, margin:'0 0 1px' }}>{s.name}</p>
                <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{formatDuration(s.duration)}</p>
              </div>
              <p style={{ color:'var(--accent)', fontWeight:800, fontSize:14, margin:0 }}>{formatCurrency(s.price)}</p>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:7 }}>
            <span style={{ color:'var(--text-sec)', fontSize:12 }}>{formatTime(appt.startTime)} – {formatTime(appt.endTime)}</span>
            <span style={{ color:'var(--accent)', fontWeight:900, fontSize:15 }}>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Tip */}
        <div style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:12, padding:'11px 13px', marginBottom:10 }}>
          <p style={{ color:'var(--text-ter)', fontSize:9, fontWeight:700, letterSpacing:'0.08em', margin:'0 0 8px' }}>PROPINA</p>
          <div style={{ display:'flex', gap:5, marginBottom:8 }}>
            {[0,10,15,20,25].map(pct => {
              const amt = pct===0 ? 0 : Math.round((appt.totalPrice||0)*pct/100)
              const sel = +tip === amt
              return (
                <button key={pct} onClick={() => setTip(amt)}
                  style={{ flex:1, padding:'7px 2px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:10, border:`1.5px solid ${sel?'var(--accent)':'var(--border)'}`, background:sel?'var(--accent-soft)':'transparent', color:sel?'var(--accent)':'var(--text-sec)' }}>
                  {pct===0 ? 'Sin' : `${pct}%`}
                </button>
              )
            })}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--card3)', borderRadius:8, padding:'8px 10px' }}>
            <DollarSign size={12} color="var(--text-ter)"/>
            <input type="number" value={tip} onChange={e => setTip(Math.max(0,+e.target.value))} min="0"
              style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text-pri)', fontSize:15, fontWeight:700, fontFamily:'inherit' }}/>
          </div>
          {+tip > 0 && <p style={{ color:'var(--accent)', fontSize:11, fontWeight:700, margin:'6px 0 0', textAlign:'right' }}>Total: {formatCurrency(total)}</p>}
        </div>

        {/* Payment method */}
        <div style={{ marginBottom:12 }}>
          <p style={{ color:'var(--text-ter)', fontSize:9, fontWeight:700, letterSpacing:'0.08em', margin:'0 0 7px' }}>MÉTODO DE PAGO</p>
          <div style={{ display:'flex', gap:5 }}>
            {['Efectivo','Tarjeta','Zelle','Otro'].map((m,i) => {
              const k = ['cash','card','zelle','other'][i]
              return (
                <button key={k} onClick={() => setPay(k)}
                  style={{ flex:1, padding:'8px 2px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:10, border:`1.5px solid ${pay===k?'var(--accent)':'var(--border)'}`, background:pay===k?'var(--accent-soft)':'transparent', color:pay===k?'var(--accent)':'var(--text-sec)' }}>
                  {m}
                </button>
              )
            })}
          </div>
        </div>

        {/* Client stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
          {[{l:'Visitas',v:visits},{l:'Total gastado',v:formatCurrency(spent)}].map(s => (
            <div key={s.l} style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 10px', textAlign:'center' }}>
              <p style={{ color:'var(--accent)', fontWeight:900, fontSize:16, margin:'0 0 2px' }}>{s.v}</p>
              <p style={{ color:'var(--text-ter)', fontSize:9, margin:0, fontWeight:600 }}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {appt.bookingStatus !== 'completed' && appt.bookingStatus !== 'cancelled' && <>
            <button onClick={() => save('completed','paid')}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', borderRadius:12, background:'var(--green-soft)', color:'var(--green)', border:'1px solid var(--green)', cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'inherit' }}>
              <CheckCircle size={15}/> Completar y marcar como pagado
            </button>
            <button onClick={() => save('completed','pending')}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', borderRadius:12, background:'var(--card2)', color:'var(--text-sec)', border:'1px solid var(--border)', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit' }}>
              <Check size={15}/> Completar (cobrar después)
            </button>
          </>}
          {(appt.bookingStatus==='completed' || appt.bookingStatus==='cancelled') && (
            <button onClick={() => save('confirmed','pending')}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', borderRadius:12, background:'var(--accent-soft)', color:'var(--accent)', border:'1px solid var(--accent)', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit' }}>
              <AlertCircle size={15}/> Revertir a pendiente
            </button>
          )}
          {appt.bookingStatus !== 'cancelled' && (
            <button onClick={() => save('cancelled','cancelled')}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', borderRadius:12, background:'var(--red-soft)', border:'1px solid var(--red)', color:'var(--red)', cursor:'pointer', fontWeight:600, fontSize:13, fontFamily:'inherit' }}>
              <XCircle size={15}/> Cancelar cita
            </button>
          )}
          <button onClick={() => save()} disabled={saving}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:12, background:'var(--accent)', border:'none', color:'#fff', cursor:'pointer', fontWeight:700, fontSize:14, fontFamily:'inherit', boxShadow:'var(--shadow-accent)', marginTop:2, opacity:saving?0.8:1 }}>
            {saving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── New Appointment modal ─────────────────────────────────────────────────
function NewApptModal({ onClose, barber, activeServices, availability, appointments }) {
  const [mode,     setMode]     = useState(null)
  const [step,     setStep]     = useState(1)
  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [notes,    setNotes]    = useState('')
  const [search,   setSearch]   = useState('')
  const [selClient,setSelClient]= useState(null)
  const [selSvc,   setSelSvc]   = useState(null)
  const [selDate,  setSelDate]  = useState(new Date())
  const [selSlot,  setSelSlot]  = useState(null)
  const [weekOff,  setWeekOff]  = useState(0)
  const [saving,   setSaving]   = useState(false)

  const today   = startOfDay(new Date())
  const advance = availability?.advanceDays || 30
  const weekDays = Array.from({length:7},(_,i)=>addDays(today,weekOff*7+i)).filter(d=>d<=addDays(today,advance))

  const clients = useMemo(() => {
    const map = {}
    appointments.forEach(a => {
      const key = a.clientId||a.clientEmail||a.clientName; if (!key) return
      if (!map[key]) map[key] = {id:key,clientId:a.clientId,name:a.clientName,email:a.clientEmail,phone:a.clientPhone,visits:0,services:{}}
      map[key].visits++
      a.services?.forEach(s => { map[key].services[s.name]=(map[key].services[s.name]||0)+1 })
    })
    return Object.values(map).sort((a,b)=>b.visits-a.visits)
  }, [appointments])

  useEffect(() => {
    if (selClient && activeServices.length > 0) {
      const top = Object.entries(selClient.services||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]
      if (top) { const f=activeServices.find(s=>s.name===top); if (f) setSelSvc(f) }
    }
  }, [selClient])

  const slots = useMemo(() => {
    if (!selSvc||!selDate||!availability) return []
    const di=selDate.getDay()
    const ds=availability.schedule?.[di]||{enabled:true,startTime:'09:00',endTime:'18:00',breaks:[]}
    if (!ds.enabled) return []
    const dateStr=format(selDate,'yyyy-MM-dd')
    const existing=appointments.filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled').map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let sl=generateTimeSlots(ds.startTime,ds.endTime,selSvc.duration,ds.breaks||[],existing)
    if (isToday(selDate)) { const nm=new Date().getHours()*60+new Date().getMinutes(); sl=sl.filter(s=>{const[h,m]=s.startTime.split(':').map(Number);return h*60+m>nm}) }
    return sl
  }, [selSvc,selDate,availability,appointments])

  function isDayOff(date) {
    if (date<today||date>addDays(today,advance)) return true
    const di=date.getDay(), ds=availability?.schedule?.[di]
    return (ds&&!ds.enabled)||(availability?.blockedDates?.includes(format(date,'yyyy-MM-dd')))
  }

  const filteredClients = clients.filter(c => {
    const s=search.toLowerCase()
    return c.name?.toLowerCase().includes(s)||c.phone?.includes(s)
  }).slice(0,8)

  async function create() {
    if (!selSvc||!selSlot) return
    setSaving(true)
    try {
      const cName  = mode==='existing'&&selClient ? selClient.name  : name.trim()
      const cPhone = mode==='existing'&&selClient ? selClient.phone||phone : phone.trim()
      const cId    = mode==='existing'&&selClient ? selClient.clientId||null : null
      await addDoc(collection(db,'appointments'), {
        barberId:barber.id, barberName:barber.name,
        clientId:cId, clientName:cName, clientPhone:cPhone,
        isGuest:!cId, isWalkIn:true,
        services:[{id:selSvc.id,name:selSvc.name,price:selSvc.price,duration:selSvc.duration}],
        date:format(selDate,'yyyy-MM-dd'), startTime:selSlot.startTime, endTime:selSlot.endTime,
        totalDuration:selSvc.duration, totalPrice:selSvc.price,
        paymentMethod:'cash', paymentStatus:'pending', bookingStatus:'confirmed',
        notes:notes.trim()||null, createdAt:serverTimestamp(),
      })
      toast.success('¡Cita creada! ✂️')
      onClose()
    } catch { toast.error('No se pudo crear') }
    finally { setSaving(false) }
  }

  const canNext = !mode ? false
    : step===1 ? (mode==='walkin' ? name.trim().length>0 : !!selClient)
    : step===2 ? !!selSvc
    : !!selSlot

  const stepLabel = !mode ? 'Nueva Cita'
    : step===1 ? (mode==='walkin' ? 'Info del cliente' : 'Seleccionar cliente')
    : step===2 ? 'Seleccionar servicio'
    : 'Fecha y hora'

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {mode && (
            <button onClick={() => { if(step>1)setStep(s=>s-1); else setMode(null) }}
              style={{ background:'none', border:'none', color:'var(--text-sec)', cursor:'pointer', display:'flex', padding:0 }}>
              <ChevronLeft size={18}/>
            </button>
          )}
          <div>
            <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 3px' }}>{stepLabel}</p>
            {mode && (
              <div style={{ display:'flex', gap:4 }}>
                {[1,2,3].map(s => (
                  <div key={s} style={{ width:s===step?14:5, height:4, borderRadius:2, background:s<=step?'var(--accent)':'var(--border)', transition:'all 0.2s' }}/>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose}
          style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 7px', color:'var(--text-sec)', cursor:'pointer', display:'flex' }}>
          <X size={14}/>
        </button>
      </div>

      <div style={{ padding:'14px 16px 20px' }}>
        {/* Mode selection */}
        {!mode && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={() => {setMode('walkin');setStep(1)}}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'14px', borderRadius:14, background:'var(--purple-soft)', border:'1.5px solid var(--purple)', cursor:'pointer', textAlign:'left', fontFamily:'inherit', width:'100%' }}>
              <div style={{ width:38, height:38, borderRadius:11, background:'var(--purple)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Plus size={18} color="#fff"/>
              </div>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 2px' }}>Walk-in / Nuevo cliente</p>
                <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>Ingresar datos manualmente</p>
              </div>
            </button>
            <button onClick={() => {setMode('existing');setStep(1)}}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'14px', borderRadius:14, background:'var(--accent-soft)', border:'1.5px solid var(--accent)', cursor:'pointer', textAlign:'left', fontFamily:'inherit', width:'100%' }}>
              <div style={{ width:38, height:38, borderRadius:11, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <User size={18} color="#fff"/>
              </div>
              <div>
                <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 2px' }}>Cliente existente</p>
                <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>Elegir de tu lista de clientes</p>
              </div>
            </button>
          </div>
        )}

        {/* Walk-in form */}
        {mode==='walkin' && step===1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[{l:'Nombre *',v:name,s:setName,t:'text',p:'Nombre del cliente'},{l:'Teléfono',v:phone,s:setPhone,t:'tel',p:'(305) 000-0000'}].map(f => (
              <div key={f.l}>
                <label style={{ display:'block', color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:5 }}>{f.l.toUpperCase()}</label>
                <input type={f.t} value={f.v} onChange={e=>f.s(e.target.value)} placeholder={f.p}
                  style={{ width:'100%', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', color:'var(--text-pri)', fontSize:14, outline:'none', fontFamily:'inherit' }}
                  onFocus={e=>e.target.style.borderColor='var(--accent)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
              </div>
            ))}
            <div>
              <label style={{ display:'block', color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:5 }}>NOTAS</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas de estilo…" rows={2}
                style={{ width:'100%', background:'var(--card2)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', color:'var(--text-pri)', fontSize:13, outline:'none', resize:'none', fontFamily:'inherit' }}/>
            </div>
          </div>
        )}

        {/* Existing client search */}
        {mode==='existing' && step===1 && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--card2)', border:'1px solid var(--border)', borderRadius:11, padding:'10px 12px', marginBottom:10 }}>
              <Search size={14} color="var(--text-ter)"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nombre o teléfono…" autoFocus
                style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text-pri)', fontSize:14, fontFamily:'inherit' }}/>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {filteredClients.length===0
                ? <p style={{ color:'var(--text-sec)', fontSize:12, textAlign:'center', padding:'16px 0' }}>No se encontraron clientes</p>
                : filteredClients.map(c => {
                    const sel = selClient?.id===c.id
                    const top = Object.entries(c.services||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]
                    return (
                      <button key={c.id} onClick={() => setSelClient(c)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, background:sel?'var(--accent-soft)':'var(--card2)', border:`1.5px solid ${sel?'var(--accent)':'var(--border)'}`, cursor:'pointer', textAlign:'left', fontFamily:'inherit', width:'100%' }}>
                        <Av name={c.name} size={34} fontSize={11}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</p>
                          <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{c.visits} visita{c.visits!==1?'s':''}{top?` · Fav: ${top}`:''}</p>
                        </div>
                        <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${sel?'var(--accent)':'var(--border)'}`, background:sel?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {sel && <Check size={10} color="#fff"/>}
                        </div>
                      </button>
                    )
                  })}
            </div>
          </div>
        )}

        {/* Service selection */}
        {mode && step===2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {mode==='existing' && selClient && (() => {
              const top = Object.entries(selClient.services||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]
              if (!top) return null
              return (
                <div style={{ background:'var(--accent-soft)', border:'1px solid var(--accent)', borderRadius:10, padding:'9px 12px', marginBottom:4 }}>
                  <p style={{ color:'var(--accent)', fontSize:10, fontWeight:700, margin:'0 0 1px' }}>⭐ RECOMENDADO</p>
                  <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>Según historial: <strong style={{ color:'var(--text-pri)' }}>{top}</strong></p>
                </div>
              )
            })()}
            {activeServices.map(svc => {
              const sel = selSvc?.id===svc.id
              return (
                <button key={svc.id} onClick={() => setSelSvc(svc)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 13px', borderRadius:12, background:sel?'var(--accent-soft)':'var(--card2)', border:`1.5px solid ${sel?'var(--accent)':'var(--border)'}`, cursor:'pointer', textAlign:'left', fontFamily:'inherit', width:'100%' }}>
                  <Scissors size={15} color={sel?'var(--accent)':'var(--text-ter)'} strokeWidth={1.8} style={{ flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:'0 0 2px' }}>{svc.name}</p>
                    <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{formatDuration(svc.duration)}</p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <p style={{ color:'var(--accent)', fontWeight:800, fontSize:14, margin:0 }}>{formatCurrency(svc.price)}</p>
                    <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${sel?'var(--accent)':'var(--border)'}`, background:sel?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {sel && <Check size={10} color="#fff"/>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Date & time */}
        {mode && step===3 && (
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <button onClick={() => {setWeekOff(w=>Math.max(0,w-1));setSelSlot(null)}} disabled={weekOff===0}
                style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:weekOff===0?'not-allowed':'pointer', opacity:weekOff===0?0.3:1, color:'var(--text-pri)' }}>
                <ChevronLeft size={14}/>
              </button>
              <span style={{ color:'var(--text-sec)', fontSize:12, fontWeight:600 }}>{weekDays[0]&&format(weekDays[0],'MMM d')} – {weekDays[weekDays.length-1]&&format(weekDays[weekDays.length-1],'MMM d')}</span>
              <button onClick={() => {setWeekOff(w=>w+1);setSelSlot(null)}} disabled={weekDays.length<7}
                style={{ background:'var(--card2)', border:'1px solid var(--border)', borderRadius:8, width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', cursor:weekDays.length<7?'not-allowed':'pointer', opacity:weekDays.length<7?0.3:1, color:'var(--text-pri)' }}>
                <ChevronRight size={14}/>
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${weekDays.length},1fr)`, gap:5, marginBottom:14 }}>
              {weekDays.map((date,i) => {
                const dis = isDayOff(date), sel = isSameDay(date,selDate)
                return (
                  <button key={i} onClick={() => {if(!dis){setSelDate(date);setSelSlot(null)}}} disabled={dis}
                    style={{ padding:'8px 2px', borderRadius:10, border:`1.5px solid ${sel?'var(--accent)':'var(--border)'}`, background:sel?'var(--accent)':'var(--card2)', cursor:dis?'not-allowed':'pointer', opacity:dis?0.2:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                    <span style={{ color:sel?'rgba(255,255,255,0.7)':'var(--text-ter)', fontSize:8, fontWeight:700 }}>{format(date,'EEE').toUpperCase()}</span>
                    <span style={{ color:sel?'#fff':isToday(date)?'var(--accent)':'var(--text-pri)', fontSize:14, fontWeight:800 }}>{format(date,'d')}</span>
                  </button>
                )
              })}
            </div>
            <p style={{ color:'var(--text-ter)', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>{format(selDate,'EEE, MMM d').toUpperCase()}</p>
            {slots.length===0
              ? <p style={{ color:'var(--text-sec)', fontSize:12, textAlign:'center', padding:'12px 0' }}>Sin horarios disponibles</p>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:10 }}>
                  {slots.map(slot => {
                    const sel = selSlot?.startTime===slot.startTime
                    return (
                      <button key={slot.startTime} onClick={() => setSelSlot(slot)}
                        style={{ padding:'10px 3px', borderRadius:10, border:`1.5px solid ${sel?'var(--accent)':'var(--border)'}`, background:sel?'var(--accent)':'var(--card2)', color:sel?'#fff':'var(--text-sec)', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                        {slot.startTime}
                      </button>
                    )
                  })}
                </div>}
            {selSlot && (
              <div style={{ background:'var(--accent-soft)', border:'1px solid var(--accent)', borderRadius:10, padding:'10px 12px' }}>
                <p style={{ color:'var(--accent)', fontWeight:700, fontSize:12, margin:0 }}>{format(selDate,'MMM d')} · {selSlot.startTime}–{selSlot.endTime}</p>
                <p style={{ color:'var(--text-sec)', fontSize:11, margin:'2px 0 0' }}>{selSvc?.name} · {formatCurrency(selSvc?.price)}</p>
              </div>
            )}
          </div>
        )}

        {/* CTA button */}
        {mode && (
          <button
            onClick={step<3 ? ()=>canNext&&setStep(s=>s+1) : create}
            disabled={!canNext||saving}
            style={{ width:'100%', marginTop:16, background:canNext?'var(--accent)':'var(--card3)', border:'none', borderRadius:22, padding:'14px', color:canNext?'#fff':'var(--text-ter)', fontWeight:700, fontSize:14, cursor:canNext?'pointer':'not-allowed', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:canNext?'var(--shadow-accent)':'none', opacity:saving?0.8:1 }}>
            {saving && <div style={{ width:15, height:15, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.75s linear infinite' }}/>}
            {step<3 ? 'Continuar →' : saving ? 'Reservando…' : '✓ Confirmar cita'}
          </button>
        )}
      </div>
    </Modal>
  )
}

// ── Appointment row ───────────────────────────────────────────────────────
function ApptRow({ a, onClick, isCurrent, formatTime }) {
  const now    = new Date()
  const isPast = apptEnd(a)<now && a.bookingStatus!=='completed' && a.bookingStatus!=='cancelled'
  return (
    <button onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
        borderRadius:12, width:'100%', cursor:'pointer', textAlign:'left', fontFamily:'inherit',
        background: isCurrent ? 'var(--accent-soft)' : isPast ? 'var(--red-soft)' : 'var(--card)',
        border: `1px solid ${isCurrent ? 'var(--accent)' : isPast ? 'var(--red)' : 'var(--border)'}`,
        opacity: a.bookingStatus==='completed' ? 0.55 : 1,
        boxShadow: isCurrent ? 'var(--shadow-accent)' : 'var(--shadow-sm)',
        marginBottom:6,
      }}>
      <Av name={a.clientName} photoURL={a.clientPhotoURL} size={34} fontSize={11} ring={isCurrent}/>
      <div style={{ display:'flex', flexDirection:'column', minWidth:44, flexShrink:0 }}>
        <p style={{ color:isCurrent?'var(--accent)':'var(--text-sec)', fontWeight:700, fontSize:11, margin:0 }}>{formatTime(a.startTime)}</p>
        <p style={{ color:'var(--text-ter)', fontSize:10, margin:0 }}>{formatTime(a.endTime)}</p>
      </div>
      <div style={{ width:1, height:22, background:'var(--border)', flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2 }}>
          <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.clientName}</p>
          {a.isWalkIn && <WBadge/>}
          {isPast && <span style={{ color:'var(--red)', fontSize:8, fontWeight:800, padding:'1px 5px', borderRadius:6, background:'var(--red-soft)', flexShrink:0 }}>FIN</span>}
        </div>
        <p style={{ color:'var(--text-sec)', fontSize:11, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.services?.map(s=>s.name).join(', ')}</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', flexShrink:0, gap:3 }}>
        <p style={{ color:'var(--accent)', fontWeight:800, fontSize:12, margin:0 }}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
        <SBadge status={a.bookingStatus} paid={a.paymentStatus==='paid'}/>
      </div>
      <ChevronRight size={13} color="var(--text-ter)"/>
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
export default function BarberDashboard() {
  const { barber, appointments, activeServices, availability, loading, todayAppts, upcomingAppts, efficiency } = useBarberData()
  const { userData } = useAuth()
  const { formatTime } = useTheme()
  const navigate = useNavigate()

  const [selAppt, setSelAppt] = useState(null)
  const [showNew, setShowNew] = useState(false)

  const now = new Date()

  const todayEarned    = useMemo(()=>todayAppts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0),[todayAppts])
  const todayProjected = useMemo(()=>todayAppts.filter(a=>a.paymentStatus!=='paid'&&a.bookingStatus!=='cancelled').reduce((s,a)=>s+(a.totalPrice||0),0),[todayAppts])

  const sorted = useMemo(() => {
    const active = todayAppts.filter(a=>apptEnd(a)>=now||a.bookingStatus==='completed'||a.bookingStatus==='cancelled')
    const ended  = todayAppts.filter(a=>apptEnd(a)<now&&a.bookingStatus!=='completed'&&a.bookingStatus!=='cancelled')
    return [...active, ...ended]
  }, [todayAppts])

  const current = sorted.find(a=>now>=apptStart(a)&&now<=apptEnd(a))
  const next    = sorted.find(a=>apptStart(a)>now&&a.bookingStatus!=='completed'&&a.bookingStatus!=='cancelled')

  const hour     = now.getHours()
  const greeting = hour<12 ? '¡Buenos días,' : hour<17 ? '¡Buenas tardes,' : '¡Buenas noches,'

  // Acciones rápidas del mockup
  const QUICK_ACTIONS = [
    { icon:CalendarPlus, label:'Nueva Cita',    action:()=>setShowNew(true),                      color:'var(--accent)' },
    { icon:Users,        label:'Cliente',        action:()=>navigate('/barber/clients'),           color:'var(--purple)' },
    { icon:Scissors,     label:'Servicio',       action:()=>navigate('/barber/services/add'),      color:'var(--green)'  },
    { icon:Clock,        label:'Bloquear hora',  action:()=>navigate('/barber/availability'),      color:'var(--amber)'  },
  ]

  if (loading) return (
    <BarberLayout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ width:22, height:22, border:'2.5px solid var(--border2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.65s linear infinite' }}/>
      </div>
    </BarberLayout>
  )

  return (
    <BarberLayout>
      <div style={{ background:'var(--bg)', minHeight:'100%', paddingBottom:24, fontFamily:"'Plus Jakarta Sans','DM Sans',system-ui,sans-serif" }}>
        <div style={{ padding:'14px 16px', maxWidth:540, margin:'0 auto' }}>

          {/* ── Greeting ── */}
          <div className="fade-up" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:13 }}>
              {/* Avatar */}
              <div style={{ width:50, height:50, borderRadius:16, overflow:'hidden', flexShrink:0, background:'var(--card2)', border:'2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:20, color:'var(--text-sec)' }}>
                {barber?.photoURL||userData?.photoURL
                  ? <img src={barber?.photoURL||userData?.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                  : (barber?.name||userData?.firstName||'B')[0]}
              </div>
              <div>
                <p style={{ color:'var(--text-sec)', fontSize:12, fontWeight:500, margin:'0 0 1px' }}>{greeting}</p>
                <h1 style={{ color:'var(--text-pri)', fontWeight:800, fontSize:22, margin:0, letterSpacing:'-0.4px', lineHeight:1.15 }}>
                  {barber?.name || `${userData?.firstName||''} ${userData?.lastName||''}`}
                </h1>
                <p style={{ color:'var(--text-ter)', fontSize:10, margin:'2px 0 0', fontWeight:600, letterSpacing:'0.06em' }}>BARBERO</p>
              </div>
            </div>
            {/* Date chip */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'7px 11px', textAlign:'right', flexShrink:0, boxShadow:'var(--shadow-sm)' }}>
              <p style={{ color:'var(--text-ter)', fontSize:9, fontWeight:700, margin:'0 0 1px', letterSpacing:'0.06em' }}>HOY</p>
              <p style={{ color:'var(--text-sec)', fontSize:11, fontWeight:600, margin:0 }}>{format(now,'d MMM, yyyy')}</p>
            </div>
          </div>

          {/* ── Stats card ── */}
          <div className="fade-up" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'14px', marginBottom:12, boxShadow:'var(--shadow)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:0 }}>Resumen de hoy</p>
              <span style={{ color:'var(--text-ter)', fontSize:11, fontWeight:600 }}>{format(now,'d MMM yyyy')}</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[
                { l:'Citas',      v:String(sorted.length),           c:'var(--text-pri)' },
                { l:'Ingresos',   v:formatCurrency(todayEarned),     c:'var(--green)'    },
                { l:'Eficiencia', v:`${efficiency}%`,                c:'var(--accent)'   },
              ].map(s => (
                <div key={s.l} style={{ background:'var(--card2)', borderRadius:12, padding:'11px 8px', textAlign:'center' }}>
                  <p style={{ color:s.c, fontWeight:900, fontSize:22, margin:'0 0 3px', letterSpacing:'-0.5px', fontVariantNumeric:'tabular-nums' }}>{s.v}</p>
                  <p style={{ color:'var(--text-ter)', fontSize:10, margin:0, fontWeight:600 }}>{s.l}</p>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            {(todayEarned+todayProjected) > 0 && (
              <div style={{ marginTop:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span style={{ color:'var(--text-sec)', fontSize:11, fontWeight:600 }}>Cobrado: {formatCurrency(todayEarned)}</span>
                  <span style={{ color:'var(--text-ter)', fontSize:11, fontWeight:500 }}>Proyectado: {formatCurrency(todayProjected)}</span>
                </div>
                <div style={{ height:4, borderRadius:2, background:'var(--card3)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:2, background:'linear-gradient(90deg,var(--accent),#FF8C42)', width:`${Math.round(todayEarned/(todayEarned+todayProjected)*100)}%`, transition:'width 0.5s' }}/>
                </div>
              </div>
            )}
          </div>

          {/* ── Now Serving ── */}
          {current && (
            <button className="fade-up" onClick={() => setSelAppt(current)}
              style={{ width:'100%', background:'linear-gradient(135deg,var(--accent),#FF8C42)', borderRadius:18, padding:'14px 16px', marginBottom:12, border:'none', cursor:'pointer', textAlign:'left', fontFamily:'inherit', boxShadow:'var(--shadow-accent)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,0.9)', animation:'pulse 1.5s infinite' }}/>
                    <span style={{ color:'rgba(255,255,255,0.85)', fontSize:9, fontWeight:800, letterSpacing:'0.12em' }}>ATENDIENDO AHORA</span>
                  </div>
                  <p style={{ color:'#fff', fontWeight:900, fontSize:20, margin:'0 0 3px', letterSpacing:'-0.4px' }}>{current.clientName}</p>
                  <p style={{ color:'rgba(255,255,255,0.72)', fontSize:12, margin:'0 0 7px' }}>{current.services?.map(s=>s.name).join(', ')}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <p style={{ color:'rgba(255,255,255,0.92)', fontWeight:900, fontSize:17, margin:0 }}>{formatCurrency(current.totalPrice)}</p>
                    <p style={{ color:'rgba(255,255,255,0.55)', fontSize:11, margin:0 }}>{formatTime(current.startTime)}–{formatTime(current.endTime)}</p>
                  </div>
                </div>
                <CircularCountdown appt={current}/>
              </div>
            </button>
          )}

          {/* ── Next up ── */}
          {!current && next && (
            <NextUpCard next={next} onClick={()=>setSelAppt(next)} formatTime={formatTime}/>
          )}

          {/* ── Quick actions grid (del mockup) ── */}
          <div className="fade-up" style={{ marginBottom:14 }}>
            <p style={{ color:'var(--text-sec)', fontSize:12, fontWeight:600, margin:'0 0 10px' }}>Acciones rápidas</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
              {QUICK_ACTIONS.map(({ icon:Icon, label, action, color }) => (
                <button key={label} onClick={action}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7, padding:'12px 6px', borderRadius:14, background:'var(--card)', border:'1px solid var(--border)', cursor:'pointer', fontFamily:'inherit', boxShadow:'var(--shadow-sm)' }}>
                  <div style={{ width:36, height:36, borderRadius:11, background:`color-mix(in srgb, ${color} 12%, transparent)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Icon size={16} color={color} strokeWidth={1.8}/>
                  </div>
                  <span style={{ color:'var(--text-sec)', fontSize:10, fontWeight:600, textAlign:'center', lineHeight:1.3 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Today's appointments ── */}
          <div className="fade-up" style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:15, margin:0 }}>Citas de hoy</p>
              <button onClick={() => navigate('/barber/calendar')}
                style={{ color:'var(--accent)', fontSize:12, fontWeight:700, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:3 }}>
                Ver agenda <ChevronRight size={13}/>
              </button>
            </div>

            {sorted.length === 0 ? (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'22px 16px', textAlign:'center', boxShadow:'var(--shadow-sm)' }}>
                <Scissors size={20} style={{ color:'var(--text-ter)', display:'block', margin:'0 auto 8px' }} strokeWidth={1.5}/>
                <p style={{ color:'var(--text-sec)', fontWeight:600, fontSize:13, margin:'0 0 3px' }}>Sin citas hoy</p>
                <p style={{ color:'var(--text-ter)', fontSize:12, margin:'0 0 14px' }}>Toca "+ Nueva Cita" para agregar una</p>
                <button onClick={() => setShowNew(true)}
                  style={{ background:'var(--accent)', border:'none', borderRadius:20, padding:'9px 20px', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', boxShadow:'var(--shadow-accent)' }}>
                  + Nueva Cita
                </button>
              </div>
            ) : (
              sorted.map(a => (
                <ApptRow key={a.id} a={a} onClick={()=>setSelAppt(a)} isCurrent={current?.id===a.id} formatTime={formatTime}/>
              ))
            )}
          </div>

          {/* ── Upcoming ── */}
          {upcomingAppts.slice(0,5).length > 0 && (
            <div className="fade-up" style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:18, padding:'13px 15px', boxShadow:'var(--shadow)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:0 }}>Próximas citas</p>
                <button onClick={() => navigate('/barber/appointments')}
                  style={{ color:'var(--accent)', fontSize:12, fontWeight:700, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:2 }}>
                  Ver todas <ChevronRight size={12}/>
                </button>
              </div>
              {upcomingAppts.slice(0,5).map((a,i) => {
                const d   = parseLocalDate(a.date)
                const lbl = isToday(d) ? 'Hoy' : isTomorrow(d) ? 'Mañana' : format(d,'d MMM')
                return (
                  <button key={a.id} onClick={() => setSelAppt(a)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:i<Math.min(upcomingAppts.length,5)-1?'1px solid var(--border)':'none', background:'transparent', border:'none', cursor:'pointer', textAlign:'left', fontFamily:'inherit', width:'100%' }}>
                    <Av name={a.clientName} photoURL={a.clientPhotoURL} size={32} fontSize={10}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:'0 0 1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.clientName}</p>
                      <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{lbl} · {formatTime(a.startTime)}</p>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
                      <p style={{ color:'var(--accent)', fontWeight:800, fontSize:13, margin:0 }}>{formatCurrency(a.totalPrice)}</p>
                      <SBadge status={a.bookingStatus} paid={a.paymentStatus==='paid'}/>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

        </div>
      </div>

      {selAppt && <ApptModal appt={selAppt} allAppts={appointments} onClose={()=>setSelAppt(null)}/>}
      {showNew && barber && (
        <NewApptModal onClose={()=>setShowNew(false)} barber={barber} activeServices={activeServices} availability={availability} appointments={appointments}/>
      )}
    </BarberLayout>
  )
}
