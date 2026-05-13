import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, formatDuration, parseLocalDate } from '../../utils/helpers'
import { format, isToday, isTomorrow, differenceInSeconds } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { useTheme } from '../../context/ThemeContext'
import { Clock, X, Scissors, Phone, Mail, Calendar, Plus, ChevronRight, TrendingUp } from 'lucide-react'

// ── Design tokens ──────────────────────────────────────────────────────────
const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1F1F1F'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const F      = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const SC = {
  pending:   ORANGE,
  confirmed: '#22C55E',
  completed: TXT3,
  cancelled: '#EF4444',
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes glow    { 0%,100%{box-shadow:0 0 0 0 rgba(255,107,26,0.4)} 50%{box-shadow:0 0 0 8px rgba(255,107,26,0)} }
  .fade-up { animation: fadeUp 0.28s cubic-bezier(0.22,1,0.36,1) both; }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 0; }
`

// ── Helpers ───────────────────────────────────────────────────────────────
function formatPhone(raw) {
  if (!raw) return null
  const d = raw.replace(/\D/g,'')
  if (d.length===10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  if (d.length===11&&d[0]==='1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
  return raw
}
function apptEnd(a)   { const [y,m,d]=a.date.split('-').map(Number),[h,mn]=a.endTime.split(':').map(Number); return new Date(y,m-1,d,h,mn,0) }
function apptStart(a) { const [y,m,d]=a.date.split('-').map(Number),[h,mn]=a.startTime.split(':').map(Number); return new Date(y,m-1,d,h,mn,0) }

// ── Avatar with initials fallback ─────────────────────────────────────────
function Avatar({ name, photoURL, size=40, fontSize=14, border=BORDER, highlight=false }) {
  const initials = name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || '?'
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      overflow:'hidden', flexShrink:0,
      background: CARD2,
      border: `2px solid ${highlight ? ORANGE : border}`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:800, fontSize, color: highlight ? ORANGE : TXT2,
      boxShadow: highlight ? `0 0 0 3px ${ORANGE}33` : 'none',
    }}>
      {photoURL
        ? <img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
        : initials}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const MAP = {
    confirmed: { bg:'rgba(34,197,94,0.12)',  color:'#22C55E',  label:'Confirmed' },
    pending:   { bg:`${ORANGE}18`,           color:ORANGE,     label:'Pending'   },
    completed: { bg:'rgba(255,255,255,0.06)',color:TXT2,       label:'Completed' },
    cancelled: { bg:'rgba(239,68,68,0.12)',  color:'#EF4444',  label:'Cancelled' },
  }
  const s = MAP[status] || MAP.pending
  return (
    <span style={{
      background:s.bg, color:s.color,
      fontSize:10, fontWeight:800, padding:'3px 9px',
      borderRadius:20, letterSpacing:'0.04em',
      whiteSpace:'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ── Countdown ─────────────────────────────────────────────────────────────
function NextCountdown({ appt }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    function calc() {
      const start=apptStart(appt), end=apptEnd(appt), now=new Date()
      if (now>=start&&now<=end) {
        const s=differenceInSeconds(end,now), m=Math.floor(s/60), sec=s%60
        setLabel(`${m}:${String(sec).padStart(2,'0')} remaining`)
        return
      }
      if (now<start) {
        const s=differenceInSeconds(start,now), m=Math.floor(s/60)
        setLabel(m>=60?`in ${Math.floor(m/60)}h ${m%60}m`:`in ${m}m`)
      }
    }
    calc(); const iv=setInterval(calc,1000); return ()=>clearInterval(iv)
  },[appt])
  return <span style={{fontVariantNumeric:'tabular-nums'}}>{label}</span>
}

// ── Tip Modal ─────────────────────────────────────────────────────────────
function TipModal({ appt, onClose }) {
  const [tip,setTip]=useState('')
  const [pay,setPay]=useState(appt?.paymentMethod||'Cash')
  const [saving,setSaving]=useState(false)
  const methods=['Cash','Square','Cash App','Zelle','Other']

  async function save() {
    setSaving(true)
    const t=parseFloat(tip)||0
    try { await updateDoc(doc(db,'appointments',appt.id),{tip:t,totalWithTip:(appt.totalPrice||0)+t,paymentMethod:pay.toLowerCase(),paymentStatus:'paid',bookingStatus:'completed'}); onClose() }
    catch {} setSaving(false)
  }
  async function skip() {
    try { await updateDoc(doc(db,'appointments',appt.id),{tip:0,totalWithTip:appt.totalPrice||0,paymentMethod:pay.toLowerCase(),paymentStatus:'paid',bookingStatus:'completed'}) }
    catch {} onClose()
  }
  if (!appt) return null

  return (
    <div style={{position:'fixed',inset:0,zIndex:80,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:480,background:CARD,borderRadius:'24px 24px 0 0',border:`1px solid ${BORDER}`,padding:'24px 20px 40px',...F}} onClick={e=>e.stopPropagation()}>
        <div style={{width:40,height:4,borderRadius:2,background:BORDER,margin:'0 auto 20px'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
          <div>
            <p style={{color:TXT2,fontSize:11,fontWeight:700,letterSpacing:'0.1em',margin:'0 0 4px'}}>APPOINTMENT COMPLETE</p>
            <p style={{color:TXT,fontWeight:800,fontSize:20,margin:'0 0 2px'}}>{appt.clientName}</p>
            <p style={{color:TXT2,fontSize:13,margin:0}}>{appt.services?.map(s=>s.name).join(', ')} · {formatCurrency(appt.totalPrice)}</p>
          </div>
          <button onClick={onClose} style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'6px 7px',color:TXT2,cursor:'pointer',display:'flex'}}><X size={16}/></button>
        </div>

        <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:16,padding:'16px',marginBottom:16}}>
          <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:12}}>ADD TIP?</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
            {['0','5','10','15','20'].map(a=>(
              <button key={a} onClick={()=>setTip(a)}
                style={{padding:'9px 16px',borderRadius:22,border:`1.5px solid ${tip===a?ORANGE:BORDER}`,background:tip===a?ORANGE:'transparent',color:tip===a?'#fff':TXT2,fontWeight:700,fontSize:13,cursor:'pointer',...F,transition:'all 0.15s'}}>
                {a==='0'?'No tip':`$${a}`}
              </button>
            ))}
          </div>
          <div style={{borderBottom:`1.5px solid ${BORDER}`,paddingBottom:10}}>
            <input type="number" value={tip} onChange={e=>setTip(e.target.value)} placeholder="Custom amount"
              style={{width:'100%',background:'transparent',border:'none',outline:'none',color:TXT,fontSize:18,fontWeight:700,...F}}/>
          </div>
        </div>

        <div style={{marginBottom:20}}>
          <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:10}}>PAYMENT METHOD</p>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {methods.map(m=>(
              <button key={m} onClick={()=>setPay(m)}
                style={{padding:'8px 14px',borderRadius:22,border:`1.5px solid ${pay===m?ORANGE:BORDER}`,background:pay===m?ORANGE:'transparent',color:pay===m?'#fff':TXT2,fontWeight:700,fontSize:12,cursor:'pointer',...F,transition:'all 0.15s'}}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderTop:`1px solid ${BORDER}`,marginBottom:16}}>
          <span style={{color:TXT2,fontSize:15}}>Total</span>
          <span style={{color:ORANGE,fontWeight:900,fontSize:22}}>{formatCurrency((appt.totalPrice||0)+(parseFloat(tip)||0))}</span>
        </div>

        <button onClick={save} disabled={saving}
          style={{width:'100%',background:ORANGE,color:'#fff',border:'none',borderRadius:22,padding:'16px',fontWeight:700,fontSize:16,cursor:'pointer',...F,marginBottom:10,boxShadow:`0 4px 24px ${ORANGE}44`,transition:'opacity 0.15s'}}>
          {saving?'Saving…':'Mark as Paid'}
        </button>
        <button onClick={skip} style={{width:'100%',background:'transparent',border:'none',color:TXT2,fontSize:14,cursor:'pointer',...F}}>
          Skip
        </button>
      </div>
    </div>
  )
}

// ── Client Modal ──────────────────────────────────────────────────────────
function ClientModal({ appt, allAppts, onClose, onReschedule, onCancel }) {
  const [clientData,setClientData]=useState(null)
  const [showAll,setShowAll]=useState(false)
  const { formatTime } = useTheme()

  useEffect(()=>{ if(!appt?.clientId)return; getDoc(doc(db,'users',appt.clientId)).then(s=>s.exists()&&setClientData(s.data())) },[appt])
  if (!appt) return null

  const isNow    = new Date()>=apptStart(appt)&&new Date()<=apptEnd(appt)
  const related  = allAppts.filter(a=>(appt.clientId&&a.clientId===appt.clientId)||(!appt.clientId&&a.clientEmail===appt.clientEmail&&a.clientEmail)).sort((a,b)=>b.date?.localeCompare(a.date))
  const visits   = related.filter(a=>a.bookingStatus==='completed').length
  const spent    = related.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const svcCount = {}; related.forEach(a=>a.services?.forEach(s=>{svcCount[s.name]=(svcCount[s.name]||0)+1}))
  const topSvc   = Object.entries(svcCount).sort((a,b)=>b[1]-a[1])[0]
  const phone    = formatPhone(appt.clientPhone)
  const items    = showAll ? related : related.slice(0,5)

  return (
    <div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:560,background:CARD,borderRadius:'22px 22px 0 0',border:`1px solid ${BORDER}`,maxHeight:'90vh',overflowY:'auto',...F}} onClick={e=>e.stopPropagation()}>

        {/* Now serving banner */}
        {isNow && (
          <div style={{background:ORANGE,padding:'12px 20px',borderRadius:'22px 22px 0 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:'#fff',animation:'pulse 1.5s infinite'}}/>
              <span style={{color:'#fff',fontWeight:800,fontSize:12,letterSpacing:'0.1em'}}>NOW SERVING</span>
            </div>
            <span style={{color:'rgba(255,255,255,0.85)',fontWeight:700,fontSize:13}}><NextCountdown appt={appt}/></span>
          </div>
        )}

        <div style={{padding:'20px'}}>
          {/* Handle */}
          {!isNow && <div style={{width:40,height:4,borderRadius:2,background:BORDER,margin:'0 auto 16px'}}/>}

          {/* Client header */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <Avatar name={appt.clientName} photoURL={clientData?.photoURL||appt.clientPhotoURL} size={54} fontSize={18} highlight={isNow}/>
              <div>
                <p style={{color:TXT,fontWeight:800,fontSize:18,margin:'0 0 4px'}}>{appt.clientName}</p>
                {appt.isGuest && (
                  <span style={{background:CARD2,color:TXT2,fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:700,border:`1px solid ${BORDER}`}}>Guest</span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'6px 7px',color:TXT2,cursor:'pointer',display:'flex'}}><X size={16}/></button>
          </div>

          {/* Contact */}
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
            {appt.clientEmail && (
              <div style={{display:'flex',alignItems:'center',gap:10,background:CARD2,borderRadius:12,padding:'10px 14px'}}>
                <Mail size={14} color={TXT3}/>
                <span style={{color:TXT2,fontSize:13}}>{appt.clientEmail}</span>
              </div>
            )}
            {phone && (
              <div style={{display:'flex',alignItems:'center',gap:10,background:CARD2,borderRadius:12,padding:'10px 14px'}}>
                <Phone size={14} color={TXT3}/>
                <a href={`tel:${appt.clientPhone}`} style={{color:ORANGE,fontSize:13,textDecoration:'none',fontWeight:600}}>{phone}</a>
              </div>
            )}
          </div>

          {/* Appointment details */}
          <div style={{background:BG,border:`1.5px solid ${isNow?`${ORANGE}44`:BORDER}`,borderRadius:16,padding:14,marginBottom:14}}>
            <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:12}}>APPOINTMENT</p>
            {appt.services?.map((s,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,marginBottom:i<appt.services.length-1?10:0}}>
                <div style={{width:32,height:32,borderRadius:10,background:CARD2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Scissors size={14} color={TXT3}/>
                </div>
                <div style={{flex:1}}>
                  <p style={{color:TXT,fontWeight:700,fontSize:14,margin:'0 0 1px'}}>{s.name}</p>
                  <p style={{color:TXT2,fontSize:12,margin:0}}>{formatDuration(s.duration)}</p>
                </div>
                <p style={{color:ORANGE,fontWeight:800,fontSize:14,flexShrink:0}}>{formatCurrency(s.price)}</p>
              </div>
            ))}
            <div style={{height:1,background:BORDER,margin:'12px 0'}}/>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{color:TXT2,fontSize:13}}>{formatTime(appt.startTime)} – {formatTime(appt.endTime)} · {formatDuration(appt.totalDuration)}</span>
              <span style={{color:ORANGE,fontWeight:900,fontSize:16}}>{formatCurrency(appt.totalWithTip||appt.totalPrice)}</span>
            </div>
            {appt.tip>0 && <p style={{color:'#22C55E',fontSize:12,margin:'6px 0 0'}}>+{formatCurrency(appt.tip)} tip</p>}
          </div>

          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
            {[{l:'Total Visits',v:visits},{l:'Total Spent',v:formatCurrency(spent)},{l:'Favorite',v:topSvc?topSvc[0]:'—',sm:true}].map(s=>(
              <div key={s.l} style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:14,padding:'12px 8px',textAlign:'center'}}>
                <p style={{color:ORANGE,fontWeight:900,fontSize:s.sm?11:18,margin:'0 0 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.v}</p>
                <p style={{color:TXT3,fontSize:10,margin:0,fontWeight:600}}>{s.l}</p>
              </div>
            ))}
          </div>

          {/* History */}
          {related.length>1 && (
            <div style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',margin:0}}>APPOINTMENT HISTORY</p>
                {related.length>5 && (
                  <button onClick={()=>setShowAll(p=>!p)} style={{background:'none',border:'none',color:ORANGE,fontSize:11,fontWeight:700,cursor:'pointer',...F}}>
                    {showAll?'Show less':'View all'}
                  </button>
                )}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {items.map(a=>(
                  <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:BG,border:`1px solid ${a.id===appt.id?`${ORANGE}44`:BORDER}`,borderLeft:`3px solid ${SC[a.bookingStatus]||BORDER}`,borderRadius:12,opacity:a.id===appt.id?1:0.65}}>
                    <div>
                      <p style={{color:a.id===appt.id?TXT:TXT2,fontWeight:a.id===appt.id?700:500,fontSize:13,margin:'0 0 2px'}}>
                        {a.date?format(parseLocalDate(a.date),'MMM d, yyyy'):'—'}{a.id===appt.id?' · Today':''}
                      </p>
                      <p style={{color:TXT3,fontSize:11,margin:0}}>{a.services?.map(s=>s.name).join(', ')}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <p style={{color:a.paymentStatus==='paid'?'#22C55E':TXT2,fontWeight:700,fontSize:13,margin:'0 0 2px'}}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
                      <StatusBadge status={a.bookingStatus}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {appt.bookingStatus!=='completed'&&appt.bookingStatus!=='cancelled' && (
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>onReschedule(appt)}
                style={{flex:1,padding:'13px',borderRadius:14,background:CARD2,border:`1px solid ${BORDER}`,color:TXT,fontWeight:600,fontSize:14,cursor:'pointer',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                <Calendar size={14}/> Reschedule
              </button>
              <button onClick={()=>onCancel(appt)}
                style={{flex:1,padding:'13px',borderRadius:14,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#EF4444',fontWeight:600,fontSize:14,cursor:'pointer',...F}}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Cancel Modal ──────────────────────────────────────────────────────────
function CancelModal({ appt, onClose, onDone }) {
  const [reason,setReason]=useState('')
  const [saving,setSaving]=useState(false)
  async function confirm() {
    setSaving(true)
    try { await updateDoc(doc(db,'appointments',appt.id),{bookingStatus:'cancelled',cancelReason:reason}); onDone() }
    catch {} setSaving(false); onClose()
  }
  return (
    <div style={{position:'fixed',inset:0,zIndex:70,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:360,background:CARD,borderRadius:22,border:`1px solid ${BORDER}`,padding:24,...F}} onClick={e=>e.stopPropagation()}>
        <p style={{color:TXT,fontWeight:800,fontSize:18,marginBottom:6}}>Cancel appointment?</p>
        <p style={{color:TXT2,fontSize:14,marginBottom:18}}>{appt.clientName} · {appt.startTime}</p>
        <div style={{borderBottom:`1.5px solid ${BORDER}`,paddingBottom:10,marginBottom:20}}>
          <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason (optional)"
            style={{width:'100%',background:'transparent',border:'none',outline:'none',color:TXT,fontSize:16,...F}}/>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'13px',borderRadius:14,background:'transparent',border:`1px solid ${BORDER}`,color:TXT2,fontWeight:600,cursor:'pointer',...F}}>Keep it</button>
          <button onClick={confirm} disabled={saving} style={{flex:1,padding:'13px',borderRadius:14,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',color:'#EF4444',fontWeight:700,cursor:'pointer',...F}}>
            {saving?'Cancelling…':'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Appointment row ───────────────────────────────────────────────────────
function ApptRow({ a, onClick, isCurrent, formatTime }) {
  const isDone = a.bookingStatus==='completed'
  return (
    <button onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
        borderRadius:14, width:'100%', cursor:'pointer', textAlign:'left', ...F,
        background: isCurrent ? `${ORANGE}12` : CARD2,
        border:`1px solid ${isCurrent ? `${ORANGE}44` : BORDER}`,
        opacity: isDone ? 0.55 : 1,
        transition:'all 0.15s', marginBottom:8,
      }}>
      <Avatar name={a.clientName} photoURL={a.clientPhotoURL} size={40} fontSize={13} highlight={isCurrent}/>
      <div style={{display:'flex',flexDirection:'column',minWidth:46,flexShrink:0}}>
        <p style={{color:isCurrent?ORANGE:TXT2,fontWeight:700,fontSize:12,margin:0}}>{formatTime(a.startTime)}</p>
        <p style={{color:TXT3,fontSize:11,margin:0}}>{formatTime(a.endTime)}</p>
      </div>
      <div style={{width:1,height:28,background:BORDER,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <p style={{color:TXT,fontWeight:700,fontSize:14,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.clientName}</p>
        <p style={{color:TXT2,fontSize:12,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.services?.map(s=>s.name).join(', ')}</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',flexShrink:0,gap:4}}>
        <p style={{color:ORANGE,fontWeight:800,fontSize:13,margin:0}}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
        <StatusBadge status={a.bookingStatus}/>
      </div>
      <ChevronRight size={14} color={TXT3}/>
    </button>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function BarberDashboard() {
  const { user }    = useAuth()
  const { formatTime } = useTheme()
  const navigate    = useNavigate()
  const [barber,setBarber]           = useState(null)
  const [allAppts,setAllAppts]       = useState([])
  const [loading,setLoading]         = useState(true)
  const [selectedAppt,setSelectedAppt] = useState(null)
  const [tipAppt,setTipAppt]         = useState(null)
  const [cancelAppt,setCancelAppt]   = useState(null)

  useEffect(()=>{ window.scrollTo(0,0) },[])

  async function autoComplete(appts) {
    const now=new Date()
    const done=appts.filter(a=>{ if(a.bookingStatus!=='confirmed'&&a.bookingStatus!=='pending')return false; return apptEnd(a)<now })
    for(const a of done){try{await updateDoc(doc(db,'appointments',a.id),{bookingStatus:'completed'})}catch{}}
    const today=format(new Date(),'yyyy-MM-dd')
    const just=done.filter(a=>a.date===today&&a.paymentStatus!=='paid')
    if(just.length>0&&!tipAppt)setTipAppt(just[0])
  }

  useEffect(()=>{
    if(!user)return
    getDocs(query(collection(db,'barbers'),where('userId','==',user.uid)))
      .then(s=>{ if(!s.empty)setBarber({id:s.docs[0].id,...s.docs[0].data()}); else setLoading(false) })
  },[user])

  useEffect(()=>{
    if(!barber)return
    const q=query(collection(db,'appointments'),where('barberId','==',barber.id))
    const unsub=onSnapshot(q,snap=>{
      const all=snap.docs.map(d=>({id:d.id,...d.data()}))
      setAllAppts(all); setLoading(false); autoComplete(all)
    })
    return unsub
  },[barber])

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  const now    = new Date()
  const today  = format(now,'yyyy-MM-dd')
  const active = allAppts.filter(a=>a.bookingStatus!=='cancelled')

  const todayAppts    = active.filter(a=>a.date===today).sort((a,b)=>a.startTime.localeCompare(b.startTime))
  const todayEarned   = todayAppts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const todayProjected= todayAppts.filter(a=>a.paymentStatus!=='paid'&&a.bookingStatus!=='cancelled').reduce((s,a)=>s+(a.totalPrice||0),0)
  const todayTips     = todayAppts.reduce((s,a)=>s+(a.tip||0),0)
  const efficiency    = todayAppts.length>0 ? Math.round((todayAppts.filter(a=>a.bookingStatus==='completed').length/todayAppts.length)*100) : 0
  const currentAppt   = todayAppts.find(a=>now>=apptStart(a)&&now<=apptEnd(a))
  const nextAppt      = todayAppts.find(a=>apptStart(a)>now)
  const upcoming      = active.filter(a=>a.date>today).sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)).slice(0,5)

  function handleReschedule(appt) { setSelectedAppt(null); navigate('/barber/calendar',{state:{rescheduleId:appt.id}}) }

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100vh',paddingBottom:100,...F}}>
        <div style={{padding:'16px 18px',maxWidth:640,margin:'0 auto'}}>

          {/* ── Header ── */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <Avatar
                name={barber?.name}
                photoURL={barber?.photoURL}
                size={48} fontSize={16}
              />
              <div>
                <p style={{color:TXT2,fontSize:12,fontWeight:500,margin:'0 0 2px'}}>
                  {now.getHours()<12?'Good morning,':now.getHours()<17?'Good afternoon,':'Good evening,'}
                </p>
                <p style={{color:TXT,fontWeight:800,fontSize:20,margin:0,letterSpacing:'-0.3px'}}>
                  {barber?.name?.split(' ')[0] || 'Barber'}
                </p>
                <p style={{color:TXT3,fontSize:11,margin:'2px 0 0',fontWeight:600,letterSpacing:'0.04em'}}>BARBER</p>
              </div>
            </div>
            <button style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:12,padding:'8px 9px',color:TXT2,cursor:'pointer',display:'flex'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
          </div>

          {/* ── Today's Overview ── */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'16px 18px',marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <p style={{color:TXT,fontWeight:700,fontSize:15,margin:0}}>Today's Overview</p>
              <span style={{color:TXT3,fontSize:12,fontWeight:600}}>{format(now,'MMM d, yyyy')}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              {[
                { label:'Appointments', value:todayAppts.length, color:TXT },
                { label:'Earnings',     value:formatCurrency(todayEarned), color:'#22C55E' },
                { label:'Efficiency',   value:`${efficiency}%`, color:ORANGE },
              ].map(s=>(
                <div key={s.label} style={{background:BG,borderRadius:14,padding:'12px 10px',textAlign:'center'}}>
                  <p style={{color:s.color,fontWeight:900,fontSize:20,margin:'0 0 4px',letterSpacing:'-0.5px'}}>{s.value}</p>
                  <p style={{color:TXT3,fontSize:10,margin:0,fontWeight:600}}>{s.label}</p>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            {(todayEarned+todayProjected)>0 && (
              <div style={{marginTop:14}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{color:TXT3,fontSize:11,fontWeight:600}}>Earned</span>
                  <span style={{color:TXT2,fontSize:11,fontWeight:600}}>Projected {formatCurrency(todayProjected)}</span>
                </div>
                <div style={{height:4,borderRadius:2,background:BORDER,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:2,background:`linear-gradient(90deg,${ORANGE},#FF8C42)`,width:`${Math.round(todayEarned/(todayEarned+todayProjected)*100)}%`,transition:'width 0.5s'}}/>
                </div>
              </div>
            )}
          </div>

          {/* ── Now Serving ── */}
          {currentAppt && (
            <button onClick={()=>setSelectedAppt(currentAppt)}
              style={{
                width:'100%',background:`linear-gradient(135deg,${ORANGE},#FF8C42)`,
                borderRadius:20,padding:'16px 18px',marginBottom:14,
                border:'none',cursor:'pointer',textAlign:'left',...F,
                boxShadow:`0 8px 32px ${ORANGE}44`,
              }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:'rgba(255,255,255,0.9)',animation:'pulse 1.5s infinite'}}/>
                    <span style={{color:'rgba(255,255,255,0.85)',fontSize:10,fontWeight:800,letterSpacing:'0.12em'}}>NOW SERVING</span>
                  </div>
                  <p style={{color:'#fff',fontWeight:900,fontSize:22,margin:'0 0 4px',letterSpacing:'-0.3px'}}>{currentAppt.clientName}</p>
                  <p style={{color:'rgba(255,255,255,0.7)',fontSize:13,margin:'0 0 10px'}}>{currentAppt.services?.map(s=>s.name).join(', ')}</p>
                  <div style={{background:'rgba(0,0,0,0.2)',borderRadius:20,padding:'5px 12px',display:'inline-flex',alignItems:'center',gap:6}}>
                    <Clock size={11} color="rgba(255,255,255,0.85)"/>
                    <span style={{color:'rgba(255,255,255,0.9)',fontWeight:700,fontSize:12}}><NextCountdown appt={currentAppt}/></span>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <p style={{color:'#fff',fontWeight:900,fontSize:24,margin:'0 0 4px',letterSpacing:'-0.5px'}}>{formatCurrency(currentAppt.totalPrice)}</p>
                  <p style={{color:'rgba(255,255,255,0.6)',fontSize:12}}>{formatTime(currentAppt.startTime)} – {formatTime(currentAppt.endTime)}</p>
                </div>
              </div>
            </button>
          )}

          {/* ── Next Up ── */}
          {!currentAppt && nextAppt && (
            <button onClick={()=>setSelectedAppt(nextAppt)}
              style={{width:'100%',background:CARD,border:`1px solid ${BORDER}`,borderLeft:`3px solid ${ORANGE}`,borderRadius:16,padding:'14px 16px',marginBottom:14,cursor:'pointer',textAlign:'left',...F}}>
              <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:6}}>NEXT UP</p>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <p style={{color:TXT,fontWeight:700,fontSize:15,margin:'0 0 3px'}}>{nextAppt.clientName}</p>
                  <p style={{color:TXT2,fontSize:13,margin:0}}>{formatTime(nextAppt.startTime)} · {nextAppt.services?.map(s=>s.name).join(', ')}</p>
                </div>
                <div style={{textAlign:'right'}}>
                  <p style={{color:ORANGE,fontWeight:800,fontSize:16,margin:'0 0 3px'}}>{formatCurrency(nextAppt.totalPrice)}</p>
                  <p style={{color:TXT3,fontSize:12,margin:0}}><NextCountdown appt={nextAppt}/></p>
                </div>
              </div>
            </button>
          )}

          {/* ── Today's Appointments ── */}
          <div style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <p style={{color:TXT,fontWeight:700,fontSize:16,margin:0}}>Today's Appointments</p>
              <button onClick={()=>navigate('/barber/calendar')}
                style={{color:ORANGE,fontSize:12,fontWeight:700,background:'none',border:'none',cursor:'pointer',...F,display:'flex',alignItems:'center',gap:3}}>
                View all <ChevronRight size={13}/>
              </button>
            </div>

            {todayAppts.length===0 ? (
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'28px',textAlign:'center'}}>
                <Scissors size={28} style={{color:TXT3,display:'block',margin:'0 auto 10px'}} strokeWidth={1.5}/>
                <p style={{color:TXT2,fontWeight:600,fontSize:14,margin:'0 0 4px'}}>No appointments today</p>
                <p style={{color:TXT3,fontSize:13,margin:0}}>Enjoy the day or add a walk-in</p>
              </div>
            ) : (
              <div>
                {todayAppts.map(a=>(
                  <ApptRow key={a.id} a={a} onClick={()=>setSelectedAppt(a)} isCurrent={currentAppt?.id===a.id} formatTime={formatTime}/>
                ))}
              </div>
            )}
          </div>

          {/* ── New Appointment CTA ── */}
          <button onClick={()=>navigate('/barber/calendar')}
            style={{
              width:'100%', background:ORANGE, color:'#fff',
              border:'none', borderRadius:22, padding:'16px',
              fontWeight:700, fontSize:16, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              ...F, boxShadow:`0 4px 24px ${ORANGE}44`, marginBottom:14,
              transition:'opacity 0.15s',
            }}>
            <Plus size={18}/> New Appointment
          </button>

          {/* ── Upcoming ── */}
          {upcoming.length>0 && (
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'16px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <p style={{color:TXT,fontWeight:700,fontSize:15,margin:0}}>Upcoming</p>
                <TrendingUp size={16} color={TXT3}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {upcoming.map(a=>{
                  const d=parseLocalDate(a.date)
                  const label=isToday(d)?'Today':isTomorrow(d)?'Tomorrow':format(d,'MMM d')
                  return (
                    <button key={a.id} onClick={()=>setSelectedAppt(a)}
                      style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:`1px solid ${BORDER}`,background:'transparent',border:'none',borderBottom:`1px solid ${BORDER}`,cursor:'pointer',textAlign:'left',...F,width:'100%'}}>
                      <Avatar name={a.clientName} photoURL={a.clientPhotoURL} size={36} fontSize={12}/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.clientName}</p>
                        <p style={{color:TXT2,fontSize:12,margin:0}}>{label} · {formatTime(a.startTime)}</p>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                        <p style={{color:ORANGE,fontWeight:800,fontSize:13,margin:0}}>{formatCurrency(a.totalPrice)}</p>
                        <StatusBadge status={a.bookingStatus}/>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {selectedAppt && (
        <ClientModal appt={selectedAppt} allAppts={allAppts}
          onClose={()=>setSelectedAppt(null)}
          onReschedule={handleReschedule}
          onCancel={a=>{setSelectedAppt(null);setCancelAppt(a)}}/>
      )}
      {tipAppt    && <TipModal    appt={tipAppt}    onClose={()=>setTipAppt(null)}/>}
      {cancelAppt && <CancelModal appt={cancelAppt} onClose={()=>setCancelAppt(null)} onDone={()=>setCancelAppt(null)}/>}
    </BarberLayout>
  )
}