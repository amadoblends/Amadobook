/**
 * BarberDashboard — Exact template match
 * ✓ Greeting + big photo outside header
 * ✓ Today's Overview stats card
 * ✓ Today's Appointments list with avatars + status
 * ✓ Now Serving card (orange gradient)
 * ✓ Compact "+ New Appointment" button
 * ✓ Appointment detail modal with tips + status actions
 * ✓ Auto-sort: active first, ended/past at bottom with ENDED badge
 * ✓ Earnings = completed + paid only
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
  Check, ChevronLeft, Search, User, Clock, CheckCircle,
  XCircle, AlertCircle, CalendarPlus, DollarSign,
} from 'lucide-react'
import toast from 'react-hot-toast'

const BG='#0D0D0D', CARD='#141414', CARD2='#1C1C1E', BORDER='#252525'
const ORANGE='#FF6B1A', TXT='#F0F0F0', TXT2='#666666', TXT3='#3A3A3A'
const GREEN='#22C55E', WALKIN='#7C3AED', RED='#EF4444'
const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.22s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
input,textarea{font-size:16px!important}
`

function apptEnd(a){const[y,m,d]=a.date.split('-').map(Number),[h,mn]=a.endTime.split(':').map(Number);return new Date(y,m-1,d,h,mn)}
function apptStart(a){const[y,m,d]=a.date.split('-').map(Number),[h,mn]=a.startTime.split(':').map(Number);return new Date(y,m-1,d,h,mn)}

function Av({name,photoURL,size=34,fontSize=11,ring=false}){
  const i=name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'
  return<div style={{width:size,height:size,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:CARD2,border:`2px solid ${ring?ORANGE:BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize,color:TXT2}}>
    {photoURL?<img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:i}
  </div>
}

function WBadge(){return<span style={{background:`${WALKIN}18`,color:WALKIN,fontSize:8,fontWeight:800,padding:'1px 5px',borderRadius:7,flexShrink:0}}>W</span>}

function SBadge({status,paid}){
  if(status==='completed')return<span style={{background:paid?`${GREEN}12`:'rgba(255,255,255,0.05)',color:paid?GREEN:TXT2,fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:20,whiteSpace:'nowrap'}}>{paid?'Paid':'Done'}</span>
  const M={confirmed:{bg:`${GREEN}12`,c:GREEN,l:'Confirmed'},pending:{bg:`${ORANGE}14`,c:ORANGE,l:'Pending'},cancelled:{bg:'rgba(239,68,68,0.1)',c:RED,l:'Cancelled'}}
  const s=M[status]||M.pending
  return<span style={{background:s.bg,color:s.c,fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:20,whiteSpace:'nowrap'}}>{s.l}</span>
}

function Countdown({appt}){
  const[l,setL]=useState('')
  useEffect(()=>{
    function c(){
      const s=apptStart(appt),e=apptEnd(appt),n=new Date()
      if(n>=s&&n<=e){const d=differenceInSeconds(e,n),m=Math.floor(d/60),sc=d%60;setL(`${m}:${String(sc).padStart(2,'0')} left`);return}
      if(n<s){const d=differenceInSeconds(s,n),m=Math.floor(d/60);setL(m>=60?`in ${Math.floor(m/60)}h ${m%60}m`:`in ${m}m`)}
    }
    c();const iv=setInterval(c,1000);return()=>clearInterval(iv)
  },[appt])
  return<span style={{fontVariantNumeric:'tabular-nums'}}>{l}</span>
}

function Modal({children,onClose,maxW=400}){
  return<div style={{position:'fixed',inset:0,zIndex:70,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'fadeIn 0.15s ease'}} onClick={onClose}>
    <div style={{width:'100%',maxWidth:maxW,background:CARD,borderRadius:20,border:`1px solid ${BORDER}`,maxHeight:'88dvh',overflowY:'auto',animation:'slideUp 0.2s ease',...F}} onClick={e=>e.stopPropagation()}>
      {children}
    </div>
  </div>
}

// ── Appt detail + tip modal ──────────────────────────────────────────────
function ApptModal({appt,allAppts,onClose}){
  const{formatTime}=useTheme()
  const[tip,setTip]=useState(appt.tip||0)
  const[pay,setPay]=useState(appt.paymentMethod||'cash')
  const[saving,setSaving]=useState(false)
  const related=allAppts.filter(a=>appt.clientId?a.clientId===appt.clientId:a.clientName===appt.clientName)
  const visits=related.filter(a=>a.bookingStatus==='completed').length
  const spent=related.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const total=(appt.totalPrice||0)+(+tip||0)

  async function save(s2,p2){
    setSaving(true)
    try{
      await updateDoc(doc(db,'appointments',appt.id),{bookingStatus:s2||appt.bookingStatus,paymentStatus:p2||appt.paymentStatus,tip:+tip||0,totalWithTip:total,paymentMethod:pay,updatedAt:serverTimestamp()})
      toast.success('Updated ✓');onClose()
    }catch{toast.error('Failed')}
    setSaving(false)
  }

  return<Modal onClose={onClose}>
    <div style={{padding:'12px 15px',borderBottom:`1px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <Av name={appt.clientName} photoURL={appt.clientPhotoURL} size={36} fontSize={12}/>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <p style={{color:TXT,fontWeight:700,fontSize:14,margin:0}}>{appt.clientName}</p>
            {appt.isWalkIn&&<WBadge/>}
          </div>
          <SBadge status={appt.bookingStatus} paid={appt.paymentStatus==='paid'}/>
        </div>
      </div>
      <button onClick={onClose} style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'5px 6px',color:TXT2,cursor:'pointer',display:'flex'}}><X size={14}/></button>
    </div>
    <div style={{padding:'12px 15px 18px'}}>
      {(appt.clientEmail||appt.clientPhone)&&<div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:10}}>
        {appt.clientEmail&&<div style={{display:'flex',alignItems:'center',gap:8,background:CARD2,borderRadius:8,padding:'6px 10px'}}><Mail size={11} color={TXT3}/><span style={{color:TXT2,fontSize:12}}>{appt.clientEmail}</span></div>}
        {appt.clientPhone&&<div style={{display:'flex',alignItems:'center',gap:8,background:CARD2,borderRadius:8,padding:'6px 10px'}}><Phone size={11} color={TXT3}/><a href={`tel:${appt.clientPhone}`} style={{color:ORANGE,fontSize:12,textDecoration:'none',fontWeight:600}}>{appt.clientPhone}</a></div>}
      </div>}

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

      {/* Tip */}
      <div style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'10px 12px',marginBottom:10}}>
        <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 8px'}}>TIP</p>
        <div style={{display:'flex',gap:5,marginBottom:8}}>
          {[0,10,15,20,25].map(pct=>{
            const amt=pct===0?0:Math.round((appt.totalPrice||0)*pct/100),sel=+tip===amt
            return<button key={pct} onClick={()=>setTip(amt)}
              style={{flex:1,padding:'6px 2px',borderRadius:8,border:`1.5px solid ${sel?ORANGE:BORDER}`,background:sel?`${ORANGE}14`:BG,color:sel?ORANGE:TXT2,fontWeight:700,fontSize:10,cursor:'pointer',...F}}>
              {pct===0?'No tip':`${pct}%`}
            </button>
          })}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,background:BG,borderRadius:8,padding:'7px 10px'}}>
          <DollarSign size={12} color={TXT3}/>
          <input type="number" value={tip} onChange={e=>setTip(Math.max(0,+e.target.value))} min="0"
            style={{flex:1,background:'transparent',border:'none',outline:'none',color:TXT,fontSize:15,fontWeight:700,...F}}/>
        </div>
        {+tip>0&&<p style={{color:ORANGE,fontSize:11,fontWeight:700,margin:'6px 0 0',textAlign:'right'}}>Total: {formatCurrency(total)}</p>}
      </div>

      {/* Payment */}
      <div style={{marginBottom:12}}>
        <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 6px'}}>PAYMENT METHOD</p>
        <div style={{display:'flex',gap:5}}>
          {['cash','card','zelle','other'].map(m=>(
            <button key={m} onClick={()=>setPay(m)}
              style={{flex:1,padding:'7px 2px',borderRadius:8,border:`1.5px solid ${pay===m?ORANGE:BORDER}`,background:pay===m?`${ORANGE}14`:BG,color:pay===m?ORANGE:TXT2,fontWeight:700,fontSize:10,cursor:'pointer',...F,textTransform:'capitalize'}}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
        {[{l:'Visits',v:visits},{l:'Lifetime',v:formatCurrency(spent)}].map(s=>(
          <div key={s.l} style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:8,padding:'7px 10px',textAlign:'center'}}>
            <p style={{color:ORANGE,fontWeight:900,fontSize:15,margin:'0 0 2px'}}>{s.v}</p>
            <p style={{color:TXT3,fontSize:9,margin:0,fontWeight:600}}>{s.l}</p>
          </div>
        ))}
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
            style={{display:'flex',alignItems:'center',gap:8,padding:'11px 13px',borderRadius:10,background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.15)',color:RED,cursor:'pointer',fontWeight:600,fontSize:13,...F}}>
            <XCircle size={15}/> Cancel Appointment
          </button>}
        <button onClick={()=>save()} disabled={saving}
          style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'12px',borderRadius:10,background:ORANGE,border:'none',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:14,...F,boxShadow:`0 4px 14px ${ORANGE}38`,marginTop:2}}>
          {saving&&<div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>}
          {saving?'Saving…':'Save Changes'}
        </button>
      </div>
    </div>
  </Modal>
}

// ── New Appointment modal ────────────────────────────────────────────────
function NewApptModal({onClose,barber,activeServices,availability,appointments}){
  const[mode,setMode]=useState(null)
  const[step,setStep]=useState(1)
  const[name,setName]=useState(''),[phone,setPhone]=useState(''),[notes,setNotes]=useState('')
  const[search,setSearch]=useState(''),[selClient,setSelClient]=useState(null)
  const[selSvc,setSelSvc]=useState(null)
  const[selDate,setSelDate]=useState(new Date()),[selSlot,setSelSlot]=useState(null)
  const[weekOff,setWeekOff]=useState(0),[saving,setSaving]=useState(false)

  const today=startOfDay(new Date()),advance=availability?.advanceDays||30
  const weekDays=Array.from({length:7},(_,i)=>addDays(today,weekOff*7+i)).filter(d=>d<=addDays(today,advance))

  const clients=useMemo(()=>{
    const map={}
    appointments.forEach(a=>{
      const key=a.clientId||a.clientEmail||a.clientName;if(!key)return
      if(!map[key])map[key]={id:key,clientId:a.clientId,name:a.clientName,email:a.clientEmail,phone:a.clientPhone,visits:0,services:{}}
      map[key].visits++;a.services?.forEach(s=>{map[key].services[s.name]=(map[key].services[s.name]||0)+1})
    })
    return Object.values(map).sort((a,b)=>b.visits-a.visits)
  },[appointments])

  useEffect(()=>{
    if(selClient&&activeServices.length>0){
      const top=Object.entries(selClient.services||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]
      if(top){const f=activeServices.find(s=>s.name===top);if(f)setSelSvc(f)}
    }
  },[selClient])

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

  const filteredClients=clients.filter(c=>{
    const s=search.toLowerCase()
    return c.name?.toLowerCase().includes(s)||c.phone?.includes(s)
  }).slice(0,8)

  async function create(){
    if(!selSvc||!selSlot)return
    setSaving(true)
    try{
      const cName=mode==='existing'&&selClient?selClient.name:name.trim()
      const cPhone=mode==='existing'&&selClient?selClient.phone||phone:phone.trim()
      const cId=mode==='existing'&&selClient?selClient.clientId||null:null
      await addDoc(collection(db,'appointments'),{
        barberId:barber.id,barberName:barber.name,clientId:cId,clientName:cName,clientPhone:cPhone,
        isGuest:!cId,isWalkIn:true,
        services:[{id:selSvc.id,name:selSvc.name,price:selSvc.price,duration:selSvc.duration}],
        date:format(selDate,'yyyy-MM-dd'),startTime:selSlot.startTime,endTime:selSlot.endTime,
        totalDuration:selSvc.duration,totalPrice:selSvc.price,
        paymentMethod:'cash',paymentStatus:'pending',bookingStatus:'confirmed',
        notes:notes.trim()||null,createdAt:serverTimestamp(),
      })
      toast.success('Appointment created ✂️');onClose()
    }catch{toast.error('Could not create')}
    finally{setSaving(false)}
  }

  const canNext=!mode?false:step===1?(mode==='walkin'?name.trim().length>0:!!selClient):step===2?!!selSvc:!!selSlot
  const stepLabel=!mode?'New Appointment':step===1?(mode==='walkin'?'Client Info':'Select Client'):step===2?'Select Service':'Date & Time'

  return<Modal onClose={onClose}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 15px',borderBottom:`1px solid ${BORDER}`}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        {mode&&<button onClick={()=>{if(step>1)setStep(s=>s-1);else setMode(null)}} style={{background:'none',border:'none',color:TXT2,cursor:'pointer',display:'flex',padding:0}}><ChevronLeft size={17}/></button>}
        <div>
          <p style={{color:TXT,fontWeight:700,fontSize:14,margin:'0 0 2px'}}>{stepLabel}</p>
          {mode&&<div style={{display:'flex',gap:4}}>{[1,2,3].map(s=><div key={s} style={{width:s===step?12:4,height:4,borderRadius:2,background:s<=step?ORANGE:BORDER,transition:'all 0.2s'}}/>)}</div>}
        </div>
      </div>
      <button onClick={onClose} style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'5px 6px',color:TXT2,cursor:'pointer',display:'flex'}}><X size={14}/></button>
    </div>
    <div style={{padding:'13px 15px 20px'}}>
      {!mode&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
        <button onClick={()=>{setMode('walkin');setStep(1)}}
          style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderRadius:12,background:`${WALKIN}10`,border:`1.5px solid ${WALKIN}30`,cursor:'pointer',textAlign:'left',...F,width:'100%'}}>
          <div style={{width:36,height:36,borderRadius:10,background:`${WALKIN}20`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Plus size={17} color={WALKIN}/></div>
          <div><p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 2px'}}>Walk-in / New Client</p><p style={{color:TXT2,fontSize:11,margin:0}}>Enter client info manually</p></div>
        </button>
        <button onClick={()=>{setMode('existing');setStep(1)}}
          style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderRadius:12,background:`${ORANGE}10`,border:`1.5px solid ${ORANGE}30`,cursor:'pointer',textAlign:'left',...F,width:'100%'}}>
          <div style={{width:36,height:36,borderRadius:10,background:`${ORANGE}20`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><User size={17} color={ORANGE}/></div>
          <div><p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 2px'}}>Existing Client</p><p style={{color:TXT2,fontSize:11,margin:0}}>Pick from your client list</p></div>
        </button>
      </div>}

      {mode==='walkin'&&step===1&&<div style={{display:'flex',flexDirection:'column',gap:10}}>
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

      {mode==='existing'&&step===1&&<div>
        <div style={{display:'flex',alignItems:'center',gap:8,background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'9px 11px',marginBottom:10}}>
          <Search size={13} color={TXT3}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or phone…" autoFocus
            style={{flex:1,background:'transparent',border:'none',outline:'none',color:TXT,fontSize:14,...F}}/>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {filteredClients.length===0?<p style={{color:TXT2,fontSize:12,textAlign:'center',padding:'16px 0'}}>No clients found</p>
          :filteredClients.map(c=>{
            const sel=selClient?.id===c.id,top=Object.entries(c.services||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]
            return<button key={c.id} onClick={()=>setSelClient(c)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:11,background:sel?`${ORANGE}12`:CARD2,border:`1.5px solid ${sel?ORANGE:BORDER}`,cursor:'pointer',textAlign:'left',...F,width:'100%'}}>
              <Av name={c.name} size={32} fontSize={10}/>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</p>
                <p style={{color:TXT2,fontSize:10,margin:0}}>{c.visits} visit{c.visits!==1?'s':''}{top?` · Fav: ${top}`:''}</p>
              </div>
              <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${sel?ORANGE:BORDER}`,background:sel?ORANGE:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {sel&&<Check size={9} color="#fff"/>}
              </div>
            </button>
          })}
        </div>
      </div>}

      {mode&&step===2&&<div style={{display:'flex',flexDirection:'column',gap:7}}>
        {mode==='existing'&&selClient&&(()=>{
          const top=Object.entries(selClient.services||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]
          if(!top)return null
          return<div style={{background:`${ORANGE}08`,border:`1px solid ${ORANGE}20`,borderRadius:10,padding:'8px 11px',marginBottom:4}}>
            <p style={{color:ORANGE,fontSize:10,fontWeight:700,margin:'0 0 1px'}}>⭐ RECOMMENDED</p>
            <p style={{color:TXT2,fontSize:11,margin:0}}>Based on history: <strong style={{color:TXT}}>{top}</strong></p>
          </div>
        })()}
        {activeServices.map(svc=>{
          const sel=selSvc?.id===svc.id
          const top=mode==='existing'&&selClient?Object.entries(selClient.services||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]:null
          const isRec=top&&svc.name===top
          return<button key={svc.id} onClick={()=>setSelSvc(svc)}
            style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:11,background:sel?`${ORANGE}12`:isRec?`${ORANGE}06`:CARD2,border:`1.5px solid ${sel?ORANGE:isRec?`${ORANGE}30`:BORDER}`,cursor:'pointer',textAlign:'left',...F,width:'100%'}}>
            <Scissors size={14} color={sel?ORANGE:TXT3} strokeWidth={1.8} style={{flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <p style={{color:TXT,fontWeight:700,fontSize:13,margin:0}}>{svc.name}</p>
                {isRec&&!sel&&<span style={{background:`${ORANGE}20`,color:ORANGE,fontSize:8,fontWeight:800,padding:'1px 5px',borderRadius:7}}>FAV</span>}
              </div>
              <p style={{color:TXT2,fontSize:11,margin:'1px 0 0'}}>{formatDuration(svc.duration)}</p>
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

      {mode&&step===3&&<div>
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

      {mode&&<button onClick={step<3?()=>canNext&&setStep(s=>s+1):create} disabled={!canNext||saving}
        style={{width:'100%',marginTop:14,background:canNext?ORANGE:BORDER,border:'none',borderRadius:20,padding:'13px',color:canNext?'#fff':TXT3,fontWeight:700,fontSize:14,cursor:canNext?'pointer':'not-allowed',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:6,boxShadow:canNext?`0 4px 14px ${ORANGE}38`:'none'}}>
        {saving&&<div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>}
        {step<3?'Continue →':saving?'Booking…':'✓ Confirm Appointment'}
      </button>}
    </div>
  </Modal>
}

// ── Appt row ─────────────────────────────────────────────────────────────
function ApptRow({a,onClick,isCurrent,formatTime}){
  const now=new Date()
  const isPast=apptEnd(a)<now&&a.bookingStatus!=='completed'&&a.bookingStatus!=='cancelled'
  return<button onClick={onClick}
    style={{display:'flex',alignItems:'center',gap:10,padding:'9px 11px',borderRadius:11,width:'100%',cursor:'pointer',textAlign:'left',...F,background:isCurrent?`${ORANGE}08`:isPast?'rgba(239,68,68,0.04)':CARD2,border:`1px solid ${isCurrent?`${ORANGE}28`:isPast?'rgba(239,68,68,0.14)':BORDER}`,opacity:a.bookingStatus==='completed'?0.5:1,transition:'all 0.12s',marginBottom:5}}>
    <Av name={a.clientName} photoURL={a.clientPhotoURL} size={32} fontSize={10} ring={isCurrent}/>
    <div style={{display:'flex',flexDirection:'column',minWidth:44,flexShrink:0}}>
      <p style={{color:isCurrent?ORANGE:TXT2,fontWeight:700,fontSize:11,margin:0}}>{formatTime(a.startTime)}</p>
      <p style={{color:TXT3,fontSize:10,margin:0}}>{formatTime(a.endTime)}</p>
    </div>
    <div style={{width:1,height:20,background:BORDER,flexShrink:0}}/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}>
        <p style={{color:TXT,fontWeight:700,fontSize:12,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.clientName}</p>
        {a.isWalkIn&&<WBadge/>}
        {isPast&&<span style={{color:RED,fontSize:8,fontWeight:800,padding:'1px 4px',borderRadius:6,background:'rgba(239,68,68,0.1)',flexShrink:0}}>ENDED</span>}
      </div>
      <p style={{color:TXT2,fontSize:11,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.services?.map(s=>s.name).join(', ')}</p>
    </div>
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',flexShrink:0,gap:3}}>
      <p style={{color:ORANGE,fontWeight:800,fontSize:12,margin:0}}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
      <SBadge status={a.bookingStatus} paid={a.paymentStatus==='paid'}/>
    </div>
    <ChevronRight size={12} color={TXT3}/>
  </button>
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
export default function BarberDashboard(){
  const{barber,appointments,activeServices,availability,loading,todayAppts,upcomingAppts,efficiency}=useBarberData()
  const{userData}=useAuth()
  const{formatTime}=useTheme()
  const navigate=useNavigate()
  const[selAppt,setSelAppt]=useState(null)
  const[showNew,setShowNew]=useState(false)

  const now=new Date()
  const todayEarned=useMemo(()=>todayAppts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0),[todayAppts])
  const todayProjected=useMemo(()=>todayAppts.filter(a=>a.paymentStatus!=='paid'&&a.bookingStatus!=='cancelled').reduce((s,a)=>s+(a.totalPrice||0),0),[todayAppts])

  const sorted=useMemo(()=>{
    const active=todayAppts.filter(a=>apptEnd(a)>=now||a.bookingStatus==='completed'||a.bookingStatus==='cancelled')
    const ended=todayAppts.filter(a=>apptEnd(a)<now&&a.bookingStatus!=='completed'&&a.bookingStatus!=='cancelled')
    return[...active,...ended]
  },[todayAppts])

  const current=sorted.find(a=>now>=apptStart(a)&&now<=apptEnd(a))
  const next=sorted.find(a=>apptStart(a)>now&&a.bookingStatus!=='completed'&&a.bookingStatus!=='cancelled')
  const greeting=now.getHours()<12?'Good morning,':now.getHours()<17?'Good afternoon,':'Good evening,'

  if(loading)return<BarberLayout><div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}><div style={{width:20,height:20,border:'2px solid #252525',borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div></BarberLayout>

  return<BarberLayout>
    <style>{CSS}</style>
    <div style={{background:BG,minHeight:'100%',paddingBottom:16,...F}}>
      <div style={{padding:'14px 16px',maxWidth:540,margin:'0 auto'}}>

        {/* Greeting */}
        <div className="fu" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:54,height:54,borderRadius:16,overflow:'hidden',flexShrink:0,background:CARD2,border:`2px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:20,color:TXT2}}>
              {barber?.photoURL||userData?.photoURL?<img src={barber?.photoURL||userData?.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:`${(barber?.name||userData?.firstName||'B')[0]}`}
            </div>
            <div>
              <p style={{color:TXT2,fontSize:12,fontWeight:500,margin:'0 0 2px'}}>{greeting}</p>
              <p style={{color:TXT,fontWeight:900,fontSize:24,margin:0,letterSpacing:'-0.5px',lineHeight:1.1}}>{barber?.name||`${userData?.firstName||''} ${userData?.lastName||''}`}</p>
              <p style={{color:TXT3,fontSize:9,margin:'2px 0 0',fontWeight:700,letterSpacing:'0.08em'}}>BARBER</p>
            </div>
          </div>
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:'6px 10px',textAlign:'right',flexShrink:0}}>
            <p style={{color:TXT3,fontSize:9,fontWeight:700,margin:'0 0 1px'}}>TODAY</p>
            <p style={{color:TXT2,fontSize:10,fontWeight:600,margin:0}}>{format(now,'MMM d, yyyy')}</p>
          </div>
        </div>

        {/* Stats card */}
        <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'12px 14px',marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <p style={{color:TXT,fontWeight:600,fontSize:13,margin:0}}>Today's Overview</p>
            <span style={{color:TXT2,fontSize:10,fontWeight:600}}>{format(now,'MMM d, yyyy')}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[{l:'Appointments',v:sorted.length,c:TXT},{l:'Earnings',v:formatCurrency(todayEarned),c:GREEN},{l:'Efficiency',v:`${efficiency}%`,c:ORANGE}].map(s=>(
              <div key={s.l} style={{background:BG,borderRadius:10,padding:'10px 8px',textAlign:'center'}}>
                <p style={{color:s.c,fontWeight:900,fontSize:20,margin:'0 0 3px',letterSpacing:'-0.4px'}}>{s.v}</p>
                <p style={{color:TXT3,fontSize:9,margin:0,fontWeight:600}}>{s.l}</p>
              </div>
            ))}
          </div>
          {(todayEarned+todayProjected)>0&&<div style={{marginTop:10}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:TXT3,fontSize:10,fontWeight:600}}>Earned</span>
              <span style={{color:TXT2,fontSize:10,fontWeight:600}}>Projected {formatCurrency(todayProjected)}</span>
            </div>
            <div style={{height:3,borderRadius:2,background:BORDER,overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:2,background:`linear-gradient(90deg,${ORANGE},#FF8C42)`,width:`${Math.round(todayEarned/(todayEarned+todayProjected)*100)}%`,transition:'width 0.5s'}}/>
            </div>
          </div>}
        </div>

        {/* Now Serving */}
        {current&&<button className="fu" onClick={()=>setSelAppt(current)}
          style={{width:'100%',background:`linear-gradient(135deg,${ORANGE},#FF8C42)`,borderRadius:14,padding:'13px 14px',marginBottom:10,border:'none',cursor:'pointer',textAlign:'left',...F,boxShadow:`0 5px 20px ${ORANGE}38`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:'rgba(255,255,255,0.9)',animation:'pulse 1.5s infinite'}}/>
                <span style={{color:'rgba(255,255,255,0.85)',fontSize:9,fontWeight:800,letterSpacing:'0.12em'}}>NOW SERVING</span>
              </div>
              <p style={{color:'#fff',fontWeight:900,fontSize:19,margin:'0 0 3px',letterSpacing:'-0.4px'}}>{current.clientName}</p>
              <p style={{color:'rgba(255,255,255,0.7)',fontSize:11,margin:'0 0 7px'}}>{current.services?.map(s=>s.name).join(', ')}</p>
              <div style={{background:'rgba(0,0,0,0.18)',borderRadius:16,padding:'4px 10px',display:'inline-flex',alignItems:'center',gap:5}}>
                <Clock size={10} color="rgba(255,255,255,0.85)"/>
                <span style={{color:'rgba(255,255,255,0.9)',fontWeight:700,fontSize:11}}><Countdown appt={current}/></span>
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <p style={{color:'#fff',fontWeight:900,fontSize:19,margin:'0 0 3px'}}>{formatCurrency(current.totalPrice)}</p>
              <p style={{color:'rgba(255,255,255,0.6)',fontSize:10}}>{formatTime(current.startTime)}–{formatTime(current.endTime)}</p>
            </div>
          </div>
        </button>}

        {/* Next up */}
        {!current&&next&&<button className="fu" onClick={()=>setSelAppt(next)}
          style={{width:'100%',background:CARD,border:`1px solid ${BORDER}`,borderLeft:`3px solid ${ORANGE}`,borderRadius:12,padding:'10px 13px',marginBottom:10,cursor:'pointer',textAlign:'left',...F}}>
          <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:3}}>NEXT UP</p>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 2px'}}>{next.clientName}</p>
              <p style={{color:TXT2,fontSize:11,margin:0}}>{formatTime(next.startTime)} · {next.services?.map(s=>s.name).join(', ')}</p>
            </div>
            <div style={{textAlign:'right'}}>
              <p style={{color:ORANGE,fontWeight:800,fontSize:13,margin:'0 0 2px'}}>{formatCurrency(next.totalPrice)}</p>
              <p style={{color:TXT3,fontSize:10,margin:0}}><Countdown appt={next}/></p>
            </div>
          </div>
        </button>}

        {/* Today's appointments */}
        <div className="fu" style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <p style={{color:TXT,fontWeight:700,fontSize:14,margin:0}}>Today's Appointments</p>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <button onClick={()=>setShowNew(true)}
                style={{display:'flex',alignItems:'center',gap:5,background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'5px 10px',color:TXT,cursor:'pointer',fontWeight:600,fontSize:11,...F}}>
                <CalendarPlus size={12} color={ORANGE}/> + New
              </button>
              <button onClick={()=>navigate('/barber/calendar')}
                style={{color:ORANGE,fontSize:11,fontWeight:700,background:'none',border:'none',cursor:'pointer',...F,display:'flex',alignItems:'center',gap:2}}>
                View all <ChevronRight size={12}/>
              </button>
            </div>
          </div>
          {sorted.length===0?(
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'18px',textAlign:'center'}}>
              <Scissors size={18} style={{color:TXT3,display:'block',margin:'0 auto 6px'}} strokeWidth={1.5}/>
              <p style={{color:TXT2,fontWeight:600,fontSize:12,margin:'0 0 2px'}}>No appointments today</p>
              <p style={{color:TXT3,fontSize:11,margin:0}}>Tap "+ New" to add one</p>
            </div>
          ):sorted.map(a=><ApptRow key={a.id} a={a} onClick={()=>setSelAppt(a)} isCurrent={current?.id===a.id} formatTime={formatTime}/>)}
        </div>

        {/* Upcoming */}
        {upcomingAppts.slice(0,5).length>0&&<div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'12px 14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <p style={{color:TXT,fontWeight:700,fontSize:13,margin:0}}>Upcoming</p>
            <TrendingUp size={14} color={TXT3}/>
          </div>
          {upcomingAppts.slice(0,5).map((a,i)=>{
            const d=parseLocalDate(a.date)
            const lbl=isToday(d)?'Today':isTomorrow(d)?'Tomorrow':format(d,'MMM d')
            return<button key={a.id} onClick={()=>setSelAppt(a)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:i<Math.min(upcomingAppts.length,5)-1?`1px solid ${BORDER}`:'none',background:'transparent',border:'none',cursor:'pointer',textAlign:'left',...F,width:'100%'}}>
              <Av name={a.clientName} photoURL={a.clientPhotoURL} size={30} fontSize={10}/>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:TXT,fontWeight:700,fontSize:12,margin:'0 0 1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.clientName}</p>
                <p style={{color:TXT2,fontSize:11,margin:0}}>{lbl} · {formatTime(a.startTime)}</p>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                <p style={{color:ORANGE,fontWeight:800,fontSize:12,margin:0}}>{formatCurrency(a.totalPrice)}</p>
                <SBadge status={a.bookingStatus} paid={a.paymentStatus==='paid'}/>
              </div>
            </button>
          })}
        </div>}
      </div>
    </div>

    {selAppt&&<ApptModal appt={selAppt} allAppts={appointments} onClose={()=>setSelAppt(null)}/>}
    {showNew&&barber&&<NewApptModal onClose={()=>setShowNew(false)} barber={barber} activeServices={activeServices} availability={availability} appointments={appointments}/>}
  </BarberLayout>
}