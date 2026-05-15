/**
 * BarberCalendar
 * ✓ Week strip with count numbers
 * ✓ Collision detection — overlapping appts show side-by-side
 * ✓ Blocked days shown as unavailable (dimmed, no click)
 * ✓ Days outside advance range blocked
 * ✓ Expand icon (top right) opens full-screen calendar view
 * ✓ Timeline with hour lines
 * ✓ FAB + button
 */
import { useState, useMemo, useRef, useEffect } from 'react'
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration, generateTimeSlots } from '../../utils/helpers'
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isToday, addWeeks, subWeeks, addDays, startOfDay,
} from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import {
  ChevronLeft, ChevronRight, X, Check,
  CheckCircle, XCircle, Scissors, Plus, Maximize2, Minimize2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525')
const ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A')
const GREEN=('#22C55E'),WALKIN=('#7C3AED')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const HOUR_H   = 64   // px per hour on timeline
const START_H  = 7    // timeline start hour
const END_H    = 21   // timeline end hour
const HOURS    = Array.from({length:END_H-START_H},(_,i)=>START_H+i)

function timeToMinutes(t){const[h,m]=t.split(':').map(Number);return h*60+m}
function minutesToPx(mins){return((mins-START_H*60)/60)*HOUR_H}

// ── Collision layout algorithm ───────────────────────────────────────────────
// Groups overlapping appointments and assigns column positions
function layoutAppointments(appts) {
  if (!appts.length) return []

  const sorted = [...appts].sort((a,b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
  const columns = [] // array of arrays of appt ids
  const result  = {}

  sorted.forEach(appt => {
    const startM = timeToMinutes(appt.startTime)
    const endM   = timeToMinutes(appt.endTime)

    // Find a column where this appt doesn't overlap
    let placed = false
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci]
      const lastAppt = sorted.find(a => a.id === col[col.length - 1])
      if (lastAppt && timeToMinutes(lastAppt.endTime) <= startM) {
        col.push(appt.id)
        result[appt.id] = { col: ci }
        placed = true
        break
      }
    }
    if (!placed) {
      result[appt.id] = { col: columns.length }
      columns.push([appt.id])
    }
  })

  // Calculate total columns needed for each appt (concurrent appts)
  sorted.forEach(appt => {
    const startM = timeToMinutes(appt.startTime)
    const endM   = timeToMinutes(appt.endTime)
    let maxCol   = result[appt.id].col

    sorted.forEach(other => {
      if (other.id === appt.id) return
      const otherStart = timeToMinutes(other.startTime)
      const otherEnd   = timeToMinutes(other.endTime)
      // Check overlap
      if (otherStart < endM && otherEnd > startM) {
        maxCol = Math.max(maxCol, result[other.id]?.col ?? 0)
      }
    })
    result[appt.id].totalCols = maxCol + 1
  })

  return sorted.map(appt => ({ ...appt, _layout: result[appt.id] }))
}

// ── Appt color by status ─────────────────────────────────────────────────────
function apptColor(a) {
  if (a.isWalkIn)                       return WALKIN
  if (a.bookingStatus === 'confirmed')  return GREEN
  if (a.bookingStatus === 'completed')  return TXT3
  if (a.bookingStatus === 'cancelled')  return '#EF4444'
  return ORANGE
}

// ── Status badge ─────────────────────────────────────────────────────────────
function Badge({status,isWalkIn}){
  if(isWalkIn&&status!=='cancelled'&&status!=='completed')
    return<span style={{background:`${WALKIN}20`,color:WALKIN,fontSize:9,fontWeight:800,padding:'1px 5px',borderRadius:8}}>W</span>
  const M={confirmed:{bg:`${GREEN}14`,c:GREEN,l:'Confirmed'},pending:{bg:`${ORANGE}14`,c:ORANGE,l:'Pending'},completed:{bg:'rgba(255,255,255,0.05)',c:TXT2,l:'Done'},cancelled:{bg:'rgba(239,68,68,0.1)',c:'#EF4444',l:'Cancelled'}}
  const s=M[status]||M.pending
  return<span style={{background:s.bg,color:s.c,fontSize:9,fontWeight:800,padding:'1px 5px',borderRadius:8}}>{s.l}</span>
}

// ── Centered modal ────────────────────────────────────────────────────────────
function Modal({children,onClose,maxWidth=380}){
  return(
    <div style={{position:'fixed',inset:0,zIndex:70,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div style={{width:'100%',maxWidth,background:CARD,borderRadius:20,border:`1px solid ${BORDER}`,maxHeight:'88dvh',overflowY:'auto',...F}} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ── New appt modal (3-step) ───────────────────────────────────────────────────
function NewApptModal({onClose,barber,activeServices,availability,appointments}){
  const[step,setStep]=useState(1)
  const[name,setName]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[notes,setNotes]=useState('')
  const[selSvc,setSelSvc]=useState(null),[selDate,setSelDate]=useState(new Date()),[selSlot,setSelSlot]=useState(null)
  const[weekOff,setWeekOff]=useState(0),[saving,setSaving]=useState(false)

  const today=startOfDay(new Date()),advance=availability?.advanceDays||30
  const weekDays=Array.from({length:7},(_,i)=>addDays(today,weekOff*7+i)).filter(d=>d<=addDays(today,advance))

  const slots=useMemo(()=>{
    if(!selSvc||!selDate||!availability)return[]
    const di=selDate.getDay()
    const ds=availability.schedule?.[di]||{enabled:(availability.workingDays||[1,2,3,4,5,6]).includes(di),startTime:availability.startTime||'09:00',endTime:availability.endTime||'18:00',breaks:availability.breaks||[]}
    if(!ds.enabled)return[]
    const dateStr=format(selDate,'yyyy-MM-dd')
    const existing=appointments.filter(a=>a.date===dateStr&&a.bookingStatus!=='cancelled').map(a=>({startTime:a.startTime,endTime:a.endTime}))
    let sl=generateTimeSlots(ds.startTime,ds.endTime,selSvc.duration,ds.breaks||[],existing)
    if(isToday(selDate)){const nm=new Date().getHours()*60+new Date().getMinutes();sl=sl.filter(s=>{const[h,m]=s.startTime.split(':').map(Number);return h*60+m>nm})}
    return sl
  },[selSvc,selDate,availability,appointments])

  function isDayOff(date){
    if(date<today)return true
    if(date>addDays(today,advance))return true
    const di=date.getDay()
    const ds=availability?.schedule?.[di]
    return(ds&&!ds.enabled)||(availability?.blockedDates?.includes(format(date,'yyyy-MM-dd')))
  }

  async function create(){
    if(!name.trim()||!selSvc||!selSlot)return
    setSaving(true)
    try{
      await addDoc(collection(db,'appointments'),{
        barberId:barber.id,barberName:barber.name,
        clientId:null,clientName:name.trim(),clientPhone:phone.trim(),clientEmail:email.trim(),
        isGuest:true,isWalkIn:true,
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
    <Modal onClose={onClose} maxWidth={400}>
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
        {step===1&&(
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[{l:'Name *',v:name,s:setName,t:'text',p:'Client name'},{l:'Phone',v:phone,s:setPhone,t:'tel',p:'(305) 000-0000'},{l:'Email',v:email,s:setEmail,t:'email',p:'optional'}].map(f=>(
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
                style={{width:'100%',background:CARD2,border:`1px solid ${BORDER}`,borderRadius:9,padding:'9px 11px',color:TXT,fontSize:13,outline:'none',resize:'none',...F}}
                onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor=BORDER}/>
            </div>
          </div>
        )}
        {step===2&&(
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {activeServices.length===0?<p style={{color:TXT2,textAlign:'center',padding:'20px 0',fontSize:13}}>No active services.</p>
            :activeServices.map(svc=>{
              const sel=selSvc?.id===svc.id
              return(
                <button key={svc.id} onClick={()=>setSelSvc(svc)}
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
              )
            })}
          </div>
        )}
        {step===3&&(
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:9}}>
              <button onClick={()=>{setWeekOff(w=>Math.max(0,w-1));setSelSlot(null)}} disabled={weekOff===0}
                style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:weekOff===0?'not-allowed':'pointer',opacity:weekOff===0?0.3:1,color:TXT}}>
                <ChevronLeft size={13}/>
              </button>
              <span style={{color:TXT2,fontSize:11,fontWeight:600}}>{weekDays[0]&&format(weekDays[0],'MMM d')} – {weekDays[weekDays.length-1]&&format(weekDays[weekDays.length-1],'MMM d')}</span>
              <button onClick={()=>{setWeekOff(w=>w+1);setSelSlot(null)}} disabled={weekDays.length<7}
                style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:weekDays.length<7?'not-allowed':'pointer',opacity:weekDays.length<7?0.3:1,color:TXT}}>
                <ChevronRight size={13}/>
              </button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:`repeat(${weekDays.length},1fr)`,gap:5,marginBottom:12}}>
              {weekDays.map((date,i)=>{
                const disabled=isDayOff(date),sel=isSameDay(date,selDate)
                return(
                  <button key={i} onClick={()=>{if(!disabled){setSelDate(date);setSelSlot(null)}}} disabled={disabled}
                    style={{padding:'7px 2px',borderRadius:9,border:`1.5px solid ${sel?ORANGE:BORDER}`,background:sel?ORANGE:CARD2,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.2:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                    <span style={{color:sel?'rgba(255,255,255,0.7)':TXT3,fontSize:8,fontWeight:700}}>{format(date,'EEE').toUpperCase()}</span>
                    <span style={{color:sel?'#fff':isToday(date)?ORANGE:TXT,fontSize:13,fontWeight:800}}>{format(date,'d')}</span>
                  </button>
                )
              })}
            </div>
            <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',marginBottom:8}}>{format(selDate,'EEE, MMM d').toUpperCase()}</p>
            {slots.length===0?<p style={{color:TXT2,fontSize:12,textAlign:'center',padding:'10px 0'}}>No available times</p>
            :<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>
              {slots.map(slot=>{
                const sel=selSlot?.startTime===slot.startTime
                return<button key={slot.startTime} onClick={()=>setSelSlot(slot)}
                  style={{padding:'9px 3px',borderRadius:9,border:`1.5px solid ${sel?ORANGE:BORDER}`,background:sel?ORANGE:CARD2,color:sel?'#fff':TXT2,fontWeight:700,fontSize:11,cursor:'pointer',...F}}>
                  {slot.startTime}
                </button>
              })}
            </div>}
            {selSlot&&<div style={{background:`${ORANGE}10`,border:`1px solid ${ORANGE}28`,borderRadius:9,padding:'9px 11px',marginTop:10}}>
              <p style={{color:ORANGE,fontWeight:700,fontSize:12,margin:0}}>{format(selDate,'MMM d')} · {selSlot.startTime}–{selSlot.endTime}</p>
              <p style={{color:TXT2,fontSize:10,margin:'2px 0 0'}}>{selSvc?.name} · {formatCurrency(selSvc?.price)}</p>
            </div>}
          </div>
        )}
        <button onClick={step<3?()=>canNext&&setStep(s=>s+1):create} disabled={!canNext||saving}
          style={{width:'100%',marginTop:14,background:canNext?ORANGE:BORDER,border:'none',borderRadius:20,padding:'13px',color:canNext?'#fff':TXT3,fontWeight:700,fontSize:14,cursor:canNext?'pointer':'not-allowed',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:6,boxShadow:canNext?`0 4px 14px ${ORANGE}38`:'none'}}>
          {saving&&<div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>}
          {step<3?'Continue →':saving?'Adding…':'✓ Confirm'}
        </button>
      </div>
    </Modal>
  )
}

// ── Appt detail modal ─────────────────────────────────────────────────────────
function ApptModal({appt,onClose,onComplete,onCancel}){
  const{formatTime}=useTheme()
  if(!appt)return null
  return(
    <Modal onClose={onClose}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 15px',borderBottom:`1px solid ${BORDER}`}}>
        <div>
          <p style={{color:TXT,fontWeight:700,fontSize:14,margin:'0 0 3px'}}>{appt.clientName}</p>
          <div style={{display:'flex',gap:5}}>
            {appt.isWalkIn&&<span style={{background:`${WALKIN}20`,color:WALKIN,fontSize:9,padding:'2px 6px',borderRadius:20,fontWeight:800}}>WALK-IN</span>}
            <Badge status={appt.bookingStatus} isWalkIn={false}/>
          </div>
        </div>
        <button onClick={onClose} style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'5px 6px',color:TXT2,cursor:'pointer',display:'flex'}}><X size={14}/></button>
      </div>
      <div style={{padding:'13px 15px 18px'}}>
        {appt.services?.map((s,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:`1px solid ${BORDER}`}}>
            <div><p style={{color:TXT,fontWeight:600,fontSize:13,margin:'0 0 1px'}}>{s.name}</p><p style={{color:TXT2,fontSize:11,margin:0}}>{formatDuration(s.duration)}</p></div>
            <p style={{color:ORANGE,fontWeight:800,fontSize:13,margin:0}}>{formatCurrency(s.price)}</p>
          </div>
        ))}
        <div style={{background:CARD2,borderRadius:9,padding:'9px 11px',margin:'10px 0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <p style={{color:TXT2,fontSize:12,margin:0}}>{formatTime(appt.startTime)} – {formatTime(appt.endTime)}</p>
            <p style={{color:ORANGE,fontWeight:800,fontSize:13,margin:0}}>{formatCurrency(appt.totalWithTip||appt.totalPrice)}</p>
          </div>
          {appt.clientPhone&&<p style={{color:TXT2,fontSize:11,margin:'4px 0 0'}}>{appt.clientPhone}</p>}
          {appt.notes&&<p style={{color:TXT2,fontSize:11,margin:'4px 0 0',fontStyle:'italic'}}>"{appt.notes}"</p>}
        </div>
        {appt.bookingStatus!=='completed'&&appt.bookingStatus!=='cancelled'&&(
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <button onClick={onComplete} style={{display:'flex',alignItems:'center',gap:7,padding:'10px 11px',borderRadius:9,background:`${GREEN}10`,color:GREEN,border:`1px solid ${GREEN}20`,cursor:'pointer',fontWeight:600,fontSize:12,...F}}>
              <CheckCircle size={13}/> Mark Completed
            </button>
            <button onClick={onCancel} style={{display:'flex',alignItems:'center',gap:7,padding:'10px 11px',borderRadius:9,background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.15)',color:'#EF4444',fontWeight:600,fontSize:12,cursor:'pointer',...F}}>
              <XCircle size={13}/> Cancel Appointment
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
export default function BarberCalendar(){
  const{barber,appointments,activeServices,availability,loading}=useBarberData()
  const{formatTime}=useTheme()

  const[weekBase,setWeekBase]=useState(startOfWeek(new Date(),{weekStartsOn:1}))
  const[selectedDay,setSelectedDay]=useState(new Date())
  const[detailAppt,setDetailAppt]=useState(null)
  const[showNew,setShowNew]=useState(false)
  const[expanded,setExpanded]=useState(false)
  const[updating,setUpdating]=useState(false)
  const timelineRef=useRef(null)

  const advance  = availability?.advanceDays || 30
  const today    = startOfDay(new Date())
  const maxDate  = addDays(today, advance)

  // Week days Mon–Sun
  const weekDays=eachDayOfInterval({
    start:weekBase,
    end:endOfWeek(weekBase,{weekStartsOn:1}),
  })

  const weekLabel=(()=>{
    const s=weekDays[0],e=weekDays[6]
    if(s.getMonth()===e.getMonth())return`${format(s,'MMM d')} – ${format(e,'d, yyyy')}`
    return`${format(s,'MMM d')} – ${format(e,'MMM d, yyyy')}`
  })()

  // Check if a day is a working day per availability config
  function isDayWorking(date){
    if(date<today||date>maxDate)return false
    const di=date.getDay()
    const ds=availability?.schedule?.[di]
    if(ds&&!ds.enabled)return false
    if(availability?.blockedDates?.includes(format(date,'yyyy-MM-dd')))return false
    return true
  }

  // Appointments for selected day (non-cancelled)
  const dayAppts=useMemo(()=>
    appointments.filter(a=>a.date===format(selectedDay,'yyyy-MM-dd')&&a.bookingStatus!=='cancelled')
    .sort((a,b)=>a.startTime.localeCompare(b.startTime))
  ,[appointments,selectedDay])

  // Layout with collision detection
  const laidOut=useMemo(()=>layoutAppointments(dayAppts),[dayAppts])

  // Appt count per day
  function countForDay(date){
    return appointments.filter(a=>a.date===format(date,'yyyy-MM-dd')&&a.bookingStatus!=='cancelled').length
  }

  // Scroll to first appt or 8am
  useEffect(()=>{
    if(!timelineRef.current)return
    const firstAppt=dayAppts[0]
    const targetMins=firstAppt?timeToMinutes(firstAppt.startTime)-30:8*60
    const targetPx=minutesToPx(targetMins)
    setTimeout(()=>timelineRef.current?.scrollTo({top:Math.max(0,targetPx-16),behavior:'smooth'}),80)
  },[selectedDay])

  async function handleComplete(){
    if(!detailAppt)return;setUpdating(true)
    try{await updateDoc(doc(db,'appointments',detailAppt.id),{bookingStatus:'completed'});toast.success('Done ✓');setDetailAppt(null)}
    catch{toast.error('Failed')}
    setUpdating(false)
  }

  async function handleCancel(){
    if(!detailAppt)return;setUpdating(true)
    try{await updateDoc(doc(db,'appointments',detailAppt.id),{bookingStatus:'cancelled',paymentStatus:'cancelled'});toast.success('Cancelled');setDetailAppt(null)}
    catch{toast.error('Failed')}
    setUpdating(false)
  }

  // Working hours for shading non-working time
  function getWorkingHours(date){
    const di=date.getDay()
    const ds=availability?.schedule?.[di]
    if(!ds||!ds.enabled)return null
    return{start:ds.startTime||'09:00',end:ds.endTime||'18:00'}
  }

  if(loading)return(
    <BarberLayout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:20,height:20,border:`2px solid #333`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  const wh=getWorkingHours(selectedDay)

  const CSS=`
    @keyframes spin{to{transform:rotate(360deg)}}
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    ::-webkit-scrollbar{display:none}
    input,textarea{font-size:16px!important}
  `

  const headerH  = expanded ? 0 : 0  // header is in BarberLayout
  const calHeight = expanded
    ? '100dvh'
    : 'calc(100dvh - calc(48px + env(safe-area-inset-top)) - calc(52px + env(safe-area-inset-bottom)))'

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{
        background:BG,
        display:'flex',
        flexDirection:'column',
        height:calHeight,
        ...(expanded?{position:'fixed',inset:0,zIndex:50,height:'100dvh'}:{}),
        ...F,
      }}>

        {/* ── WEEK HEADER ── */}
        <div style={{background:CARD,borderBottom:`0.5px solid ${BORDER}`,flexShrink:0}}>

          {/* Week nav + expand button */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px 6px'}}>
            <button onClick={()=>{setWeekBase(w=>subWeeks(w,1))}}
              style={{background:'none',border:'none',color:TXT2,cursor:'pointer',padding:'4px',display:'flex'}}>
              <ChevronLeft size={17}/>
            </button>
            <span style={{color:TXT,fontWeight:700,fontSize:13,letterSpacing:'-0.2px'}}>{weekLabel}</span>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button onClick={()=>setWeekBase(w=>addWeeks(w,1))}
                style={{background:'none',border:'none',color:TXT2,cursor:'pointer',padding:'4px',display:'flex'}}>
                <ChevronRight size={17}/>
              </button>
              {/* ── Expand/collapse icon ── */}
              <button onClick={()=>setExpanded(e=>!e)}
                style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:TXT2,marginLeft:4}}>
                {expanded?<Minimize2 size={13}/>:<Maximize2 size={13}/>}
              </button>
            </div>
          </div>

          {/* Day strip Mon–Sun */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1,padding:'0 6px 8px'}}>
            {weekDays.map((date,i)=>{
              const sel     = isSameDay(date,selectedDay)
              const tod     = isToday(date)
              const working = isDayWorking(date)
              const isPast  = date < today
              const count   = countForDay(date)
              const outOfRange = date > maxDate

              return(
                <button key={i}
                  onClick={()=>setSelectedDay(date)}
                  style={{
                    display:'flex',flexDirection:'column',alignItems:'center',
                    gap:2,padding:'5px 2px',borderRadius:10,border:'none',
                    cursor: outOfRange ? 'not-allowed' : 'pointer',
                    background:'transparent',
                    opacity: outOfRange ? 0.15 : isPast ? 0.5 : 1,
                  }}>
                  {/* Day label */}
                  <span style={{color:sel?ORANGE:TXT3,fontSize:8,fontWeight:700,letterSpacing:'0.04em'}}>
                    {format(date,'EEE').toUpperCase()}
                  </span>
                  {/* Date in orange circle if selected */}
                  <div style={{
                    width:28,height:28,borderRadius:'50%',
                    background:sel?ORANGE:'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    transition:'all 0.15s',
                    // Dot for non-working days in range
                    border: !sel && !working && !isPast && !outOfRange ? `1px solid ${BORDER}` : 'none',
                  }}>
                    <span style={{
                      fontSize:14,
                      fontWeight:sel?800:tod?700:600,
                      color:sel?'#fff':tod?ORANGE:!working&&!isPast?TXT3:TXT,
                    }}>
                      {format(date,'d')}
                    </span>
                  </div>
                  {/* Appt count OR "off" indicator */}
                  <span style={{fontSize:9,fontWeight:800,color:sel?ORANGE:count>0?ORANGE:TXT3,lineHeight:1,minHeight:10}}>
                    {count>0?count:!working&&!isPast&&!outOfRange?'·':''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── TIMELINE ── */}
        <div ref={timelineRef} style={{flex:1,overflowY:'auto',position:'relative',background:BG}}>
          <div style={{position:'relative',minHeight:HOURS.length*HOUR_H+HOUR_H}}>

            {/* Non-working time shading */}
            {wh && (()=>{
              const workStart = minutesToPx(timeToMinutes(wh.start))
              const workEnd   = minutesToPx(timeToMinutes(wh.end))
              const totalH    = HOURS.length * HOUR_H
              return(
                <>
                  {/* Before work */}
                  <div style={{position:'absolute',left:0,right:0,top:0,height:workStart,background:'rgba(255,255,255,0.015)',zIndex:1,pointerEvents:'none'}}/>
                  {/* After work */}
                  <div style={{position:'absolute',left:0,right:0,top:workEnd,bottom:0,background:'rgba(255,255,255,0.015)',height:totalH-workEnd,zIndex:1,pointerEvents:'none'}}/>
                </>
              )
            })()}

            {/* Hour rows */}
            {HOURS.map(hour=>(
              <div key={hour} style={{
                position:'absolute',left:0,right:0,
                top:(hour-START_H)*HOUR_H,
                height:HOUR_H,
                display:'flex',alignItems:'flex-start',
              }}>
                {/* Hour label */}
                <div style={{width:52,flexShrink:0,paddingTop:2,paddingLeft:10,textAlign:'right',paddingRight:8}}>
                  <span style={{color:TXT3,fontSize:10,fontWeight:600,whiteSpace:'nowrap'}}>
                    {hour===12?'12 PM':hour>12?`${hour-12} PM`:`${hour} AM`}
                  </span>
                </div>
                {/* Hour line */}
                <div style={{flex:1,height:1,background:BORDER,opacity:0.45,marginTop:0}}/>
              </div>
            ))}

            {/* Appointment cards — collision-aware */}
            <div style={{position:'absolute',left:52,right:8,top:0,bottom:0}}>
              {laidOut.map(appt=>{
                const startMins = timeToMinutes(appt.startTime)
                const endMins   = timeToMinutes(appt.endTime)
                const topPx     = minutesToPx(startMins)
                const heightPx  = Math.max(((endMins-startMins)/60)*HOUR_H-3,32)
                const color     = apptColor(appt)
                const layout    = appt._layout || {col:0,totalCols:1}
                const colW      = 100/layout.totalCols
                const leftPct   = layout.col * colW
                const gap       = layout.totalCols > 1 ? 2 : 0

                return(
                  <button key={appt.id}
                    onClick={()=>setDetailAppt(appt)}
                    style={{
                      position:'absolute',
                      top:topPx+2,
                      left:`calc(${leftPct}% + ${gap}px)`,
                      width:`calc(${colW}% - ${gap*2}px)`,
                      height:heightPx,
                      borderRadius:8,
                      background:CARD2,
                      border:`1px solid ${BORDER}`,
                      borderLeft:`3px solid ${color}`,
                      cursor:'pointer',textAlign:'left',
                      padding:'5px 8px',
                      display:'flex',flexDirection:'column',
                      justifyContent:'flex-start',
                      overflow:'hidden',
                      ...F,
                      zIndex:2,
                    }}>
                    {/* Client name + walk-in badge */}
                    <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:1}}>
                      <p style={{color:TXT,fontWeight:700,fontSize:11,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>
                        {appt.clientName}
                      </p>
                      {appt.isWalkIn&&<span style={{color:WALKIN,fontSize:9,fontWeight:800,flexShrink:0}}>W</span>}
                    </div>
                    {/* Services */}
                    <p style={{color:TXT2,fontSize:10,margin:'0 0 1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {appt.services?.map(s=>s.name).join(' + ')}
                    </p>
                    {/* Time — only if tall enough */}
                    {heightPx>42&&(
                      <p style={{color:TXT3,fontSize:10,margin:0}}>
                        {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                      </p>
                    )}
                    {/* Price — right aligned, only if wide enough */}
                    <div style={{position:'absolute',top:5,right:6}}>
                      <p style={{color:ORANGE,fontWeight:800,fontSize:11,margin:0}}>{formatCurrency(appt.totalWithTip||appt.totalPrice)}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* "Day off" overlay if selected day is blocked/off */}
            {!isDayWorking(selectedDay)&&!appointments.some(a=>a.date===format(selectedDay,'yyyy-MM-dd')&&a.bookingStatus!=='cancelled')&&(
              <div style={{position:'absolute',left:52,right:8,top:minutesToPx(9*60),display:'flex',alignItems:'center',justifyContent:'center',padding:'12px 14px',zIndex:3}}>
                <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'12px 16px',textAlign:'center'}}>
                  <p style={{color:TXT3,fontSize:12,fontWeight:600,margin:'0 0 2px'}}>
                    {selectedDay<today?'Past day':selectedDay>maxDate?`Outside booking range (${advance} days)`:'Day off'}
                  </p>
                  <p style={{color:TXT3,fontSize:10,margin:0}}>
                    {selectedDay>maxDate?`Clients can book up to ${advance} days ahead`:'Not a working day'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── FAB ── */}
        <button onClick={()=>setShowNew(true)}
          style={{
            position:'fixed',
            bottom:`calc(${expanded?16:64}px + env(safe-area-inset-bottom))`,
            right:16,
            width:48,height:48,borderRadius:'50%',
            background:ORANGE,border:'none',cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:`0 4px 18px ${ORANGE}55`,zIndex:55,
          }}>
          <Plus size={20} color="#fff" strokeWidth={2.5}/>
        </button>
      </div>

      {detailAppt&&<ApptModal appt={detailAppt} onClose={()=>setDetailAppt(null)} onComplete={handleComplete} onCancel={handleCancel}/>}
      {showNew&&barber&&<NewApptModal onClose={()=>setShowNew(false)} barber={barber} activeServices={activeServices} availability={availability} appointments={appointments}/>}
    </BarberLayout>
  )
}