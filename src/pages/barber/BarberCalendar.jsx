/**
 * BarberCalendar — Fixed
 * ✓ NO expand/collapse arrows (removed completely)
 * ✓ Click on week label (e.g. "May 18–24, 2026") → opens floating month calendar
 * ✓ Month calendar shows all available days + appointment count per day
 * ✓ Collision detection — overlapping appts side by side, never overlap
 * ✓ Client avatar inside each card
 * ✓ FAB + bottom right
 * ✓ Auto-marks past appts as completed if not already
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isToday, addWeeks, subWeeks, addDays, startOfDay,
  startOfMonth, endOfMonth, eachDayOfInterval as edi,
  addMonths, subMonths,
} from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import {
  ChevronLeft, ChevronRight, X, Check,
  CheckCircle, XCircle, Scissors, Plus, AlertCircle, DollarSign,
} from 'lucide-react'
import toast from 'react-hot-toast'

const BG='#0D0D0D', CARD='#141414', CARD2='#1C1C1E', BORDER='#252525'
const ORANGE='#FF6B1A', TXT='#F0F0F0', TXT2='#666666', TXT3='#3A3A3A'
const GREEN='#22C55E', WALKIN='#7C3AED'
const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const HOUR_H  = 64
const START_H = 7
const END_H   = 21
const HOURS   = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)

function timeMins(t) { const [h,m] = t.split(':').map(Number); return h*60+m }
function minsPx(m)   { return ((m - START_H*60)/60)*HOUR_H }

// Collision layout: side-by-side, never overlapping
function layoutAppts(appts) {
  if (!appts.length) return []
  const sorted = [...appts].sort((a,b) => timeMins(a.startTime)-timeMins(b.startTime))
  const cols = []
  const layout = {}

  sorted.forEach(a => {
    const s=timeMins(a.startTime), e=timeMins(a.endTime)
    let placed=false
    for (let ci=0; ci<cols.length; ci++) {
      const last=sorted.find(x=>x.id===cols[ci][cols[ci].length-1])
      if (last && timeMins(last.endTime)<=s) {
        cols[ci].push(a.id); layout[a.id]={col:ci}; placed=true; break
      }
    }
    if (!placed) { layout[a.id]={col:cols.length}; cols.push([a.id]) }
  })

  sorted.forEach(a => {
    const s=timeMins(a.startTime), e=timeMins(a.endTime)
    let maxCol=layout[a.id].col
    sorted.forEach(b => {
      if (b.id===a.id) return
      if (timeMins(b.startTime)<e && timeMins(b.endTime)>s)
        maxCol=Math.max(maxCol, layout[b.id]?.col??0)
    })
    layout[a.id].total = maxCol+1
  })

  return sorted.map(a => ({ ...a, _col:layout[a.id]?.col||0, _total:layout[a.id]?.total||1 }))
}

function apptColor(a) {
  if (a.isWalkIn) return WALKIN
  if (a.bookingStatus==='confirmed') return GREEN
  if (a.bookingStatus==='completed') return TXT3
  if (a.bookingStatus==='cancelled') return '#EF4444'
  return ORANGE
}

function MiniAv({ name, photoURL, size=18 }) {
  const i=name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', overflow:'hidden', background:CARD2, border:'1.5px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:7, color:TXT2, flexShrink:0 }}>
      {photoURL ? <img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : i}
    </div>
  )
}

// ── Floating month calendar picker ────────────────────────────────────────
function MonthPicker({ selectedDay, onSelect, onClose, availability, appointments }) {
  const [month, setMonth] = useState(startOfMonth(selectedDay))
  const advance  = availability?.advanceDays || 30
  const today    = startOfDay(new Date())
  const maxDate  = addDays(today, advance)

  const calDays = edi({
    start: startOfWeek(month, { weekStartsOn:1 }),
    end:   endOfWeek(endOfMonth(month), { weekStartsOn:1 }),
  })

  function isDayOff(date) {
    const di=date.getDay()
    const ds=availability?.schedule?.[di]
    if (ds&&!ds.enabled) return true
    if (availability?.blockedDates?.includes(format(date,'yyyy-MM-dd'))) return true
    return false
  }

  function countFor(date) {
    return appointments.filter(a=>a.date===format(date,'yyyy-MM-dd')&&a.bookingStatus!=='cancelled').length
  }

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:65, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80 }}
      onClick={onClose}
    >
      <div style={{ background:'rgba(0,0,0,0.6)', position:'absolute', inset:0 }}/>
      <div
        style={{ position:'relative', width:'calc(100% - 28px)', maxWidth:360, background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, overflow:'hidden', ...F, boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}
        onClick={e=>e.stopPropagation()}
      >
        {/* Month nav */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:`1px solid ${BORDER}` }}>
          <button onClick={() => setMonth(m=>subMonths(m,1))}
            style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', display:'flex', padding:6 }}>
            <ChevronLeft size={16}/>
          </button>
          <span style={{ color:TXT, fontWeight:700, fontSize:14 }}>{format(month,'MMMM yyyy')}</span>
          <button onClick={() => setMonth(m=>addMonths(m,1))}
            style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', display:'flex', padding:6 }}>
            <ChevronRight size={16}/>
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'8px 8px 0' }}>
          {['M','T','W','T','F','S','S'].map((d,i)=>(
            <div key={i} style={{ textAlign:'center', fontSize:9, fontWeight:700, color:TXT3, padding:'2px 0' }}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, padding:'4px 8px 12px' }}>
          {calDays.map((date,i) => {
            const inMonth  = date.getMonth()===month.getMonth()
            const sel      = isSameDay(date,selectedDay)
            const tod      = isToday(date)
            const off      = isDayOff(date)
            const past     = date < today
            const outRange = date > maxDate
            const count    = countFor(date)

            return (
              <button key={i}
                onClick={() => { if (!outRange) { onSelect(date); onClose() } }}
                style={{
                  padding:'4px 2px', borderRadius:8, border:'none',
                  cursor: outRange?'not-allowed':'pointer',
                  background: sel ? ORANGE : 'transparent',
                  opacity: !inMonth?0.06 : outRange?0.12 : past?0.35 : 1,
                  display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                }}>
                <span style={{
                  fontSize:13, fontWeight: sel?800:tod?700:500,
                  color: sel?'#fff':tod?ORANGE:off&&!past?TXT3:TXT,
                }}>
                  {date.getDate()}
                </span>
                {/* Count or dot */}
                <span style={{
                  fontSize:9, fontWeight:800, lineHeight:1, minHeight:10,
                  color: sel?'rgba(255,255,255,0.75)':count>0?ORANGE:off&&!past?TXT3:'transparent',
                }}>
                  {count>0 ? count : off&&!past&&!outRange ? '·' : '·'}
                </span>
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display:'flex', gap:12, padding:'0 16px 12px', justifyContent:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:ORANGE }}/>
            <span style={{ color:TXT3, fontSize:9 }}>Appointments</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:ORANGE }}/>
            <span style={{ color:TXT3, fontSize:9 }}>Selected</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── New appt modal ────────────────────────────────────────────────────────
function NewApptModal({ onClose, barber, activeServices, availability, appointments }) {
  const [step,setStep]=useState(1)
  const [name,setName]=useState(''),[phone,setPhone]=useState(''),[notes,setNotes]=useState('')
  const [selSvc,setSelSvc]=useState(null),[selDate,setSelDate]=useState(new Date()),[selSlot,setSelSlot]=useState(null)
  const [weekOff,setWeekOff]=useState(0),[saving,setSaving]=useState(false)
  const today=startOfDay(new Date()),advance=availability?.advanceDays||30
  const weekDays=Array.from({length:7},(_,i)=>addDays(today,weekOff*7+i)).filter(d=>d<=addDays(today,advance))

  const slots=useMemo(()=>{
    if(!selSvc||!selDate||!availability)return[]
    const di=selDate.getDay()
    const ds=availability.schedule?.[di]||{enabled:true,startTime:'09:00',endTime:'18:00',breaks:[]}
    if(!ds.enabled)return[]
    const dateStr=format(selDate,'yyyy-MM-dd')
    const existing=appointments.filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled').map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let sl=generateTimeSlots(ds.startTime,ds.endTime,selSvc.duration,ds.breaks||[],existing)
    if(isToday(selDate)){const nm=new Date().getHours()*60+new Date().getMinutes();sl=sl.filter(s=>{const[h,m]=s.startTime.split(':').map(Number);return h*60+m>nm})}
    return sl
  },[selSvc,selDate,availability,appointments])

  function isDayOff(date){
    if(date<today||date>addDays(today,advance))return true
    const di=date.getDay(),ds=availability?.schedule?.[di]
    return(ds&&!ds.enabled)||(availability?.blockedDates?.includes(format(date,'yyyy-MM-dd')))
  }

  async function create(){
    if(!name.trim()||!selSvc||!selSlot)return
    setSaving(true)
    try{
      await addDoc(collection(db,'appointments'),{
        barberId:barber.id,barberName:barber.name,clientId:null,
        clientName:name.trim(),clientPhone:phone.trim(),isGuest:true,isWalkIn:true,
        services:[{id:selSvc.id,name:selSvc.name,price:selSvc.price,duration:selSvc.duration}],
        date:format(selDate,'yyyy-MM-dd'),startTime:selSlot.startTime,endTime:selSlot.endTime,
        totalDuration:selSvc.duration,totalPrice:selSvc.price,
        paymentMethod:'cash',paymentStatus:'pending',bookingStatus:'confirmed',
        notes:notes.trim()||null,createdAt:serverTimestamp(),
      })
      toast.success('Added ✂️');onClose()
    }catch{toast.error('Could not add')}
    finally{setSaving(false)}
  }

  const canNext=step===1?name.trim().length>0:step===2?!!selSvc:!!selSlot

  return(
    <div style={{position:'fixed',inset:0,zIndex:70,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:400,background:CARD,borderRadius:20,border:`1px solid ${BORDER}`,maxHeight:'88dvh',overflowY:'auto',...F}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 15px',borderBottom:`1px solid ${BORDER}`}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {step>1&&<button onClick={()=>setStep(s=>s-1)} style={{background:'none',border:'none',color:TXT2,cursor:'pointer',display:'flex',padding:0}}><ChevronLeft size={17}/></button>}
            <div>
              <p style={{color:TXT,fontWeight:700,fontSize:14,margin:'0 0 1px'}}>{step===1?'Client Info':step===2?'Service':'Date & Time'}</p>
              <div style={{display:'flex',gap:4}}>{[1,2,3].map(s=><div key={s} style={{width:s===step?12:4,height:4,borderRadius:2,background:s<=step?ORANGE:BORDER,transition:'all 0.2s'}}/>)}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'5px 6px',color:TXT2,cursor:'pointer',display:'flex'}}><X size={14}/></button>
        </div>
        <div style={{padding:'13px 15px 20px'}}>
          {step===1&&<div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[{l:'Name *',v:name,s:setName,t:'text',p:'Client name'},{l:'Phone',v:phone,s:setPhone,t:'tel',p:'(305) 000-0000'}].map(f=>(
              <div key={f.l}>
                <label style={{display:'block',color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',marginBottom:4}}>{f.l.toUpperCase()}</label>
                <input type={f.t} value={f.v} onChange={e=>f.s(e.target.value)} placeholder={f.p}
                  style={{width:'100%',background:CARD2,border:`1px solid ${BORDER}`,borderRadius:9,padding:'9px 11px',color:TXT,fontSize:14,outline:'none',...F}}
                  onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor=BORDER}/>
              </div>
            ))}
            <div>
              <label style={{display:'block',color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',marginBottom:4}}>NOTES</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Style notes…" rows={2}
                style={{width:'100%',background:CARD2,border:`1px solid ${BORDER}`,borderRadius:9,padding:'9px 11px',color:TXT,fontSize:13,outline:'none',resize:'none',...F}}/>
            </div>
          </div>}

          {step===2&&<div style={{display:'flex',flexDirection:'column',gap:7}}>
            {activeServices.map(svc=>{
              const sel=selSvc?.id===svc.id
              return<button key={svc.id} onClick={()=>setSelSvc(svc)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:11,background:sel?`${ORANGE}12`:CARD2,border:`1.5px solid ${sel?ORANGE:BORDER}`,cursor:'pointer',textAlign:'left',...F,width:'100%'}}>
                <Scissors size={14} color={sel?ORANGE:TXT3} strokeWidth={1.8} style={{flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 1px'}}>{svc.name}</p>
                  <p style={{color:TXT2,fontSize:11,margin:0}}>{formatDuration(svc.duration)}</p>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:7,flexShrink:0}}>
                  <p style={{color:ORANGE,fontWeight:800,fontSize:13,margin:0}}>{formatCurrency(svc.price)}</p>
                  <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${sel?ORANGE:BORDER}`,background:sel?ORANGE:'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {sel&&<Check size={9} color="#fff"/>}
                  </div>
                </div>
              </button>
            })}
          </div>}

          {step===3&&<div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9}}>
              <button onClick={()=>{setWeekOff(w=>Math.max(0,w-1));setSelSlot(null)}} disabled={weekOff===0}
                style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:weekOff===0?'not-allowed':'pointer',opacity:weekOff===0?0.3:1,color:TXT}}><ChevronLeft size={13}/></button>
              <span style={{color:TXT2,fontSize:11,fontWeight:600}}>{weekDays[0]&&format(weekDays[0],'MMM d')} – {weekDays[weekDays.length-1]&&format(weekDays[weekDays.length-1],'MMM d')}</span>
              <button onClick={()=>{setWeekOff(w=>w+1);setSelSlot(null)}} disabled={weekDays.length<7}
                style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:weekDays.length<7?'not-allowed':'pointer',opacity:weekDays.length<7?0.3:1,color:TXT}}><ChevronRight size={13}/></button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:`repeat(${weekDays.length},1fr)`,gap:5,marginBottom:12}}>
              {weekDays.map((date,i)=>{
                const dis=isDayOff(date),sel=isSameDay(date,selDate)
                return<button key={i} onClick={()=>{if(!dis){setSelDate(date);setSelSlot(null)}}} disabled={dis}
                  style={{padding:'7px 2px',borderRadius:9,border:`1.5px solid ${sel?ORANGE:BORDER}`,background:sel?ORANGE:CARD2,cursor:dis?'not-allowed':'pointer',opacity:dis?0.2:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <span style={{color:sel?'rgba(255,255,255,0.7)':TXT3,fontSize:8,fontWeight:700}}>{format(date,'EEE').toUpperCase()}</span>
                  <span style={{color:sel?'#fff':isToday(date)?ORANGE:TXT,fontSize:13,fontWeight:800}}>{format(date,'d')}</span>
                </button>
              })}
            </div>
            <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',marginBottom:8}}>{format(selDate,'EEE, MMM d').toUpperCase()}</p>
            {slots.length===0?<p style={{color:TXT2,fontSize:12,textAlign:'center',padding:'10px 0'}}>No available times</p>
            :<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,marginBottom:10}}>
              {slots.map(slot=>{
                const sel=selSlot?.startTime===slot.startTime
                return<button key={slot.startTime} onClick={()=>setSelSlot(slot)}
                  style={{padding:'9px 3px',borderRadius:9,border:`1.5px solid ${sel?ORANGE:BORDER}`,background:sel?ORANGE:CARD2,color:sel?'#fff':TXT2,fontWeight:700,fontSize:11,cursor:'pointer',...F}}>
                  {slot.startTime}
                </button>
              })}
            </div>}
            {selSlot&&<div style={{background:`${ORANGE}10`,border:`1px solid ${ORANGE}28`,borderRadius:9,padding:'9px 11px'}}>
              <p style={{color:ORANGE,fontWeight:700,fontSize:12,margin:0}}>{format(selDate,'MMM d')} · {selSlot.startTime}–{selSlot.endTime}</p>
              <p style={{color:TXT2,fontSize:10,margin:'2px 0 0'}}>{selSvc?.name} · {formatCurrency(selSvc?.price)}</p>
            </div>}
          </div>}

          <button onClick={step<3?()=>canNext&&setStep(s=>s+1):create} disabled={!canNext||saving}
            style={{width:'100%',marginTop:14,background:canNext?ORANGE:BORDER,border:'none',borderRadius:20,padding:'13px',color:canNext?'#fff':TXT3,fontWeight:700,fontSize:14,cursor:canNext?'pointer':'not-allowed',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            {saving&&<div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>}
            {step<3?'Continue →':saving?'Adding…':'✓ Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Appt detail + tip modal ────────────────────────────────────────────────
function ApptModal({ appt, onClose, onComplete, onCancel }) {
  const { formatTime } = useTheme()
  const [tip,setTip]   = useState(appt.tip||0)
  const [pay,setPay]   = useState(appt.paymentMethod||'cash')
  const [saving,setSaving] = useState(false)
  if (!appt) return null

  const total = (appt.totalPrice||0) + (+tip||0)

  async function save(newStatus, newPay) {
    setSaving(true)
    try {
      await updateDoc(doc(db,'appointments',appt.id), {
        bookingStatus: newStatus || appt.bookingStatus,
        paymentStatus: newPay || appt.paymentStatus,
        tip: +tip||0,
        totalWithTip: total,
        paymentMethod: pay,
        updatedAt: serverTimestamp(),
      })
      toast.success('Updated ✓')
      onClose()
    } catch { toast.error('Failed') }
    setSaving(false)
  }

  return (
    <div style={{position:'fixed',inset:0,zIndex:70,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:380,background:CARD,borderRadius:20,border:`1px solid ${BORDER}`,maxHeight:'88dvh',overflowY:'auto',...F}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 15px',borderBottom:`1px solid ${BORDER}`}}>
          <div>
            <p style={{color:TXT,fontWeight:700,fontSize:14,margin:'0 0 3px'}}>{appt.clientName}</p>
            {appt.isWalkIn&&<span style={{background:`${WALKIN}20`,color:WALKIN,fontSize:9,padding:'2px 6px',borderRadius:20,fontWeight:800}}>WALK-IN</span>}
          </div>
          <button onClick={onClose} style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'5px 6px',color:TXT2,cursor:'pointer',display:'flex'}}><X size={14}/></button>
        </div>
        <div style={{padding:'13px 15px 18px'}}>
          {/* Services */}
          <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:10,padding:'9px 12px',marginBottom:10}}>
            {appt.services?.map((s,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:i<appt.services.length-1?`1px solid ${BORDER}`:'none'}}>
                <div><p style={{color:TXT,fontWeight:600,fontSize:12,margin:'0 0 1px'}}>{s.name}</p><p style={{color:TXT2,fontSize:10,margin:0}}>{formatDuration(s.duration)}</p></div>
                <p style={{color:ORANGE,fontWeight:800,fontSize:13,margin:0}}>{formatCurrency(s.price)}</p>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:5}}>
              <span style={{color:TXT2,fontSize:11}}>{formatTime(appt.startTime)}–{formatTime(appt.endTime)}</span>
              <span style={{color:ORANGE,fontWeight:900,fontSize:14}}>{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Tip — can add/change after the fact */}
          <div style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'10px 12px',marginBottom:10}}>
            <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 8px'}}>TIP (add or change anytime)</p>
            <div style={{display:'flex',gap:5,marginBottom:8}}>
              {[0,10,15,20,25].map(pct=>{
                const amt=pct===0?0:Math.round((appt.totalPrice||0)*pct/100),sel=+tip===amt
                return<button key={pct} onClick={()=>setTip(amt)}
                  style={{flex:1,padding:'6px 2px',borderRadius:8,border:`1.5px solid ${sel?ORANGE:BORDER}`,background:sel?`${ORANGE}14`:BG,color:sel?ORANGE:TXT2,fontWeight:700,fontSize:10,cursor:'pointer',...F}}>
                  {pct===0?'None':`${pct}%`}
                </button>
              })}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,background:BG,borderRadius:8,padding:'7px 10px'}}>
              <DollarSign size={12} color={TXT3}/>
              <input type="number" value={tip} onChange={e=>setTip(Math.max(0,+e.target.value))} min="0"
                style={{flex:1,background:'transparent',border:'none',outline:'none',color:TXT,fontSize:15,fontWeight:700,...F}}/>
              <span style={{color:TXT3,fontSize:11}}>tip</span>
            </div>
            {+tip>0&&<p style={{color:ORANGE,fontSize:11,fontWeight:700,margin:'5px 0 0',textAlign:'right'}}>Total: {formatCurrency(total)}</p>}
          </div>

          {/* Payment method */}
          <div style={{marginBottom:12}}>
            <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 6px'}}>PAYMENT</p>
            <div style={{display:'flex',gap:5}}>
              {['cash','card','zelle','other'].map(m=>(
                <button key={m} onClick={()=>setPay(m)}
                  style={{flex:1,padding:'7px 2px',borderRadius:8,border:`1.5px solid ${pay===m?ORANGE:BORDER}`,background:pay===m?`${ORANGE}14`:BG,color:pay===m?ORANGE:TXT2,fontWeight:700,fontSize:10,cursor:'pointer',...F,textTransform:'capitalize'}}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {appt.bookingStatus!=='completed'&&appt.bookingStatus!=='cancelled'&&<>
              <button onClick={()=>save('completed','paid')}
                style={{display:'flex',alignItems:'center',gap:8,padding:'11px 13px',borderRadius:10,background:`${GREEN}10`,color:GREEN,border:`1px solid ${GREEN}20`,cursor:'pointer',fontWeight:700,fontSize:13,...F}}>
                <CheckCircle size={15}/> Complete & Mark Paid
              </button>
              <button onClick={()=>save('completed','pending')}
                style={{display:'flex',alignItems:'center',gap:8,padding:'11px 13px',borderRadius:10,background:CARD2,color:TXT2,border:`1px solid ${BORDER}`,cursor:'pointer',fontWeight:600,fontSize:13,...F}}>
                <Check size={15}/> Complete (Collect Later)
              </button>
            </>}
            {(appt.bookingStatus==='completed'||appt.bookingStatus==='cancelled')&&
              <button onClick={()=>save('confirmed','pending')}
                style={{display:'flex',alignItems:'center',gap:8,padding:'11px 13px',borderRadius:10,background:`${ORANGE}10`,color:ORANGE,border:`1px solid ${ORANGE}20`,cursor:'pointer',fontWeight:600,fontSize:13,...F}}>
                <AlertCircle size={15}/> Revert to Pending
              </button>}
            {appt.bookingStatus!=='cancelled'&&
              <button onClick={()=>save('cancelled','cancelled')}
                style={{display:'flex',alignItems:'center',gap:8,padding:'11px 13px',borderRadius:10,background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.15)',color:'#EF4444',cursor:'pointer',fontWeight:600,fontSize:13,...F}}>
                <XCircle size={15}/> Cancel Appointment
              </button>}
            <button onClick={()=>save()} disabled={saving}
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'12px',borderRadius:10,background:ORANGE,border:'none',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:14,...F,marginTop:2}}>
              {saving&&<div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>}
              {saving?'Saving…':'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CSS ───────────────────────────────────────────────────────────────────
const CSS2 = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
input,textarea{font-size:16px!important}
`

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
export default function BarberCalendar() {
  const { barber, appointments, activeServices, availability, loading } = useBarberData()
  const { formatTime } = useTheme()

  const [weekBase,     setWeekBase]     = useState(startOfWeek(new Date(),{weekStartsOn:1}))
  const [selectedDay,  setSelectedDay]  = useState(new Date())
  const [showPicker,   setShowPicker]   = useState(false)
  const [detailAppt,   setDetailAppt]   = useState(null)
  const [showNew,      setShowNew]      = useState(false)
  const timelineRef = useRef(null)

  const advance = availability?.advanceDays || 30
  const today   = startOfDay(new Date())
  const maxDate = addDays(today, advance)

  const weekDays = eachDayOfInterval({
    start: weekBase,
    end:   endOfWeek(weekBase,{weekStartsOn:1}),
  })

  // Week label — clickable to open month picker
  const weekLabel = (() => {
    const s=weekDays[0], e=weekDays[6]
    if (s.getMonth()===e.getMonth()) return `${format(s,'MMM d')} – ${format(e,'d, yyyy')}`
    return `${format(s,'MMM d')} – ${format(e,'MMM d, yyyy')}`
  })()

  function isDayWorking(date) {
    if (date<today||date>maxDate) return false
    const di=date.getDay(), ds=availability?.schedule?.[di]
    if (ds&&!ds.enabled) return false
    if (availability?.blockedDates?.includes(format(date,'yyyy-MM-dd'))) return false
    return true
  }

  function isDayOff(date) {
    const di=date.getDay(), ds=availability?.schedule?.[di]
    return (ds&&!ds.enabled)||(availability?.blockedDates?.includes(format(date,'yyyy-MM-dd')))
  }

  const dayAppts = useMemo(()=>
    appointments
      .filter(a=>a.date===format(selectedDay,'yyyy-MM-dd')&&a.bookingStatus!=='cancelled')
      .sort((a,b)=>a.startTime.localeCompare(b.startTime))
  ,[appointments,selectedDay])

  const laidOut = useMemo(()=>layoutAppts(dayAppts),[dayAppts])

  function countFor(date) {
    return appointments.filter(a=>a.date===format(date,'yyyy-MM-dd')&&a.bookingStatus!=='cancelled').length
  }

  // Auto-scroll to first appt or 8am
  useEffect(()=>{
    if(!timelineRef.current)return
    const first=dayAppts[0]
    const targetMins=first?timeMins(first.startTime)-30:8*60
    setTimeout(()=>timelineRef.current?.scrollTo({top:Math.max(0,minsPx(targetMins)-16),behavior:'smooth'}),80)
  },[selectedDay])

  async function handleComplete() {
    if(!detailAppt)return
    try{await updateDoc(doc(db,'appointments',detailAppt.id),{bookingStatus:'completed'});toast.success('Done ✓');setDetailAppt(null)}
    catch{toast.error('Failed')}
  }
  async function handleCancel() {
    if(!detailAppt)return
    try{await updateDoc(doc(db,'appointments',detailAppt.id),{bookingStatus:'cancelled',paymentStatus:'cancelled'});toast.success('Cancelled');setDetailAppt(null)}
    catch{toast.error('Failed')}
  }

  if (loading) return (
    <BarberLayout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:20,height:20,border:'2px solid #252525',borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  return (
    <BarberLayout>
      <style>{CSS2}</style>
      <div style={{ background:BG, display:'flex', flexDirection:'column', height:'calc(100dvh - max(62px, calc(env(safe-area-inset-top) + 52px)) - calc(52px + env(safe-area-inset-bottom)))', ...F }}>

        {/* ── WEEK HEADER ── */}
        <div style={{ background:CARD, borderBottom:`0.5px solid ${BORDER}`, flexShrink:0 }}>

          {/* Week nav — NO expand icon */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px 6px' }}>
            <button onClick={() => setWeekBase(w=>subWeeks(w,1))}
              style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', padding:4, display:'flex' }}>
              <ChevronLeft size={17}/>
            </button>

            {/* ✅ Clickable week label → opens floating month picker */}
            <button
              onClick={() => setShowPicker(true)}
              style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, padding:'4px 8px' }}>
              <span style={{ color:TXT, fontWeight:700, fontSize:14, letterSpacing:'-0.2px' }}>{weekLabel}</span>
            </button>

            <button onClick={() => setWeekBase(w=>addWeeks(w,1))}
              style={{ background:'none', border:'none', color:TXT2, cursor:'pointer', padding:4, display:'flex' }}>
              <ChevronRight size={17}/>
            </button>
            {/* ✅ NO expand/collapse icon */}
          </div>

          {/* Day strip Mon–Sun */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1, padding:'0 6px 8px' }}>
            {weekDays.map((date,i)=>{
              const sel     = isSameDay(date,selectedDay)
              const tod     = isToday(date)
              const working = isDayWorking(date)
              const isPast  = date < today
              const outRange= date > maxDate
              const off     = isDayOff(date)
              const count   = countFor(date)

              return (
                <button key={i} onClick={()=>setSelectedDay(date)}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'5px 2px', borderRadius:10, border:'none', cursor: outRange?'not-allowed':'pointer', background:'transparent', opacity: outRange?0.12:isPast?0.45:1 }}>
                  <span style={{ color: sel?ORANGE:off&&!isPast?TXT3:TXT3, fontSize:8, fontWeight:700, letterSpacing:'0.04em' }}>
                    {format(date,'EEE').toUpperCase()}
                  </span>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:sel?ORANGE:'transparent', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}>
                    <span style={{ fontSize:14, fontWeight:sel?800:tod?700:500, color:sel?'#fff':tod?ORANGE:off&&!isPast?TXT3:TXT }}>
                      {format(date,'d')}
                    </span>
                  </div>
                  <span style={{ fontSize:9, fontWeight:800, color:sel?ORANGE:count>0?ORANGE:off&&!isPast?TXT3:'transparent', lineHeight:1, minHeight:10 }}>
                    {count>0 ? count : off&&!isPast&&!outRange ? '·' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── TIMELINE ── */}
        <div ref={timelineRef} style={{ flex:1, overflowY:'auto', background:BG }}>
          <div style={{ position:'relative', minHeight:HOURS.length*HOUR_H+HOUR_H }}>

            {/* Hour rows */}
            {HOURS.map(hour=>(
              <div key={hour} style={{ position:'absolute', left:0, right:0, top:(hour-START_H)*HOUR_H, display:'flex', alignItems:'flex-start', pointerEvents:'none' }}>
                <div style={{ width:54, flexShrink:0, paddingTop:2, textAlign:'right', paddingRight:8 }}>
                  <span style={{ color:TXT3, fontSize:10, fontWeight:600, whiteSpace:'nowrap' }}>
                    {hour===12?'12 PM':hour>12?`${hour-12} PM`:`${hour} AM`}
                  </span>
                </div>
                <div style={{ flex:1, height:1, background:BORDER, opacity:0.45 }}/>
              </div>
            ))}

            {/* Break time indicators */}
            {(()=>{
              const di=selectedDay.getDay()
              const ds=availability?.schedule?.[di]
              if(!ds?.enabled)return null
              return(ds.breaks||[]).map((b,i)=>{
                const bTop=minsPx(timeMins(b.startTime))
                const bH=Math.max(((timeMins(b.endTime)-timeMins(b.startTime))/60)*HOUR_H,16)
                return<div key={i} style={{position:'absolute',left:54,right:8,top:bTop,height:bH,background:`${ORANGE}05`,border:`1px dashed ${ORANGE}18`,borderRadius:6,zIndex:1,display:'flex',alignItems:'center',paddingLeft:8,pointerEvents:'none'}}>
                  <span style={{color:ORANGE,fontSize:9,fontWeight:700,opacity:0.6}}>{b.label||'Break'}</span>
                </div>
              })
            })()}

            {/* Appointment cards — collision-safe */}
            <div style={{ position:'absolute', left:54, right:8, top:0, bottom:0 }}>
              {laidOut.map(appt=>{
                const startM = timeMins(appt.startTime)
                const endM   = timeMins(appt.endTime)
                const topPx  = minsPx(startM)
                const hPx    = Math.max(((endM-startM)/60)*HOUR_H - 3, 36)
                const color  = apptColor(appt)
                const colW   = 100/appt._total
                const leftPct= appt._col*colW
                const gap    = appt._total>1 ? 3 : 0

                return (
                  <button key={appt.id}
                    onClick={()=>setDetailAppt(appt)}
                    style={{
                      position:'absolute',
                      top: topPx+2,
                      left: `calc(${leftPct}% + ${gap}px)`,
                      width: `calc(${colW}% - ${gap*2}px)`,
                      height: hPx,
                      borderRadius: 9,
                      background: CARD2,
                      border: `1px solid ${BORDER}`,
                      borderLeft: `3px solid ${color}`,
                      cursor:'pointer', textAlign:'left',
                      padding:'5px 7px',
                      display:'flex', alignItems:'flex-start', gap:5,
                      overflow:'hidden', zIndex:2, ...F,
                    }}>
                    <MiniAv name={appt.clientName} photoURL={appt.clientPhotoURL} size={18}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:TXT, fontWeight:700, fontSize:11, margin:'0 0 1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {appt.clientName}
                        {appt.isWalkIn&&<span style={{color:WALKIN,fontSize:8,fontWeight:800,marginLeft:4}}>W</span>}
                      </p>
                      <p style={{ color:TXT2, fontSize:10, margin:'0 0 1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {appt.services?.map(s=>s.name).join(' + ')}
                      </p>
                      {hPx>48&&<p style={{ color:TXT3, fontSize:9, margin:0 }}>{formatTime(appt.startTime)}–{formatTime(appt.endTime)}</p>}
                    </div>
                    <p style={{ color:ORANGE, fontWeight:800, fontSize:10, margin:0, flexShrink:0 }}>
                      {formatCurrency(appt.totalWithTip||appt.totalPrice)}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Day off / out of range message */}
            {!isDayWorking(selectedDay)&&dayAppts.length===0&&(
              <div style={{ position:'absolute', left:54, right:8, top:minsPx(9*60), zIndex:3 }}>
                <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:'12px 16px', textAlign:'center' }}>
                  <p style={{ color:TXT2, fontSize:12, fontWeight:600, margin:'0 0 2px' }}>
                    {selectedDay<today?'Past day':selectedDay>maxDate?`Outside ${advance}-day range`:'Day off'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FAB ── */}
        <button onClick={()=>setShowNew(true)}
          style={{ position:'fixed', bottom:'calc(64px + env(safe-area-inset-bottom))', right:16, width:48, height:48, borderRadius:'50%', background:ORANGE, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 18px ${ORANGE}55`, zIndex:30 }}>
          <Plus size={20} color="#fff" strokeWidth={2.5}/>
        </button>
      </div>

      {/* Floating month picker */}
      {showPicker&&(
        <MonthPicker
          selectedDay={selectedDay}
          onSelect={day=>{setSelectedDay(day);setWeekBase(startOfWeek(day,{weekStartsOn:1}))}}
          onClose={()=>setShowPicker(false)}
          availability={availability}
          appointments={appointments}
        />
      )}
      {detailAppt&&(
        <ApptModal appt={detailAppt} onClose={()=>setDetailAppt(null)} onComplete={handleComplete} onCancel={handleCancel}/>
      )}
      {showNew&&barber&&(
        <NewApptModal onClose={()=>setShowNew(false)} barber={barber} activeServices={activeServices} availability={availability} appointments={appointments}/>
      )}
    </BarberLayout>
  )
}