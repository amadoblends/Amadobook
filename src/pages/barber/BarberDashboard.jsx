/**
 * BarberDashboard — compact iPhone UI
 * ✓ Uses useBarberData (no Firebase calls, instant)
 * ✓ Walk-in via "New Appointment" button
 * ✓ Walk-in badge on all cards
 * ✓ Compact spacing
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, formatDuration, parseLocalDate } from '../../utils/helpers'
import { format, isToday, isTomorrow, differenceInSeconds } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { useTheme } from '../../context/ThemeContext'
import { Clock, X, Scissors, Phone, Mail, Calendar, Plus, ChevronRight, TrendingUp, Check, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useEffect } from 'react'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A'),GREEN=('#22C55E'),WALKIN=('#7C3AED')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.fu{animation:fadeUp 0.22s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

function apptStart(a){const[y,m,d]=a.date.split('-').map(Number),[h,mn]=a.startTime.split(':').map(Number);return new Date(y,m-1,d,h,mn)}
function apptEnd(a){const[y,m,d]=a.date.split('-').map(Number),[h,mn]=a.endTime.split(':').map(Number);return new Date(y,m-1,d,h,mn)}

function Avatar({name,photoURL,size=34,fontSize=11}){
  const i=name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'
  return(
    <div style={{width:size,height:size,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:CARD2,border:`1.5px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize,color:TXT2}}>
      {photoURL?<img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:i}
    </div>
  )
}

function WalkInBadge(){return<span style={{background:`${WALKIN}18`,color:WALKIN,fontSize:8,fontWeight:800,padding:'1px 5px',borderRadius:8,letterSpacing:'0.03em',flexShrink:0}}>W</span>}

function StatusBadge({status,isWalkIn}){
  if(isWalkIn&&status!=='cancelled'&&status!=='completed')
    return<span style={{background:`${WALKIN}18`,color:WALKIN,fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:20,whiteSpace:'nowrap'}}>Walk-in</span>
  const M={confirmed:{bg:`${GREEN}12`,c:GREEN,l:'Confirmed'},pending:{bg:`${ORANGE}14`,c:ORANGE,l:'Pending'},completed:{bg:'rgba(255,255,255,0.04)',c:TXT2,l:'Completed'},cancelled:{bg:'rgba(239,68,68,0.1)',c:'#EF4444',l:'Cancelled'}}
  const s=M[status]||M.pending
  return<span style={{background:s.bg,color:s.c,fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:20,whiteSpace:'nowrap'}}>{s.l}</span>
}

function Countdown({appt}){
  const[label,setLabel]=useState('')
  useEffect(()=>{
    function calc(){
      const start=apptStart(appt),end=apptEnd(appt),now=new Date()
      if(now>=start&&now<=end){const s=differenceInSeconds(end,now),m=Math.floor(s/60),sec=s%60;setLabel(`${m}:${String(sec).padStart(2,'0')} left`);return}
      if(now<start){const s=differenceInSeconds(start,now),m=Math.floor(s/60);setLabel(m>=60?`in ${Math.floor(m/60)}h ${m%60}m`:`in ${m}m`)}
    }
    calc();const iv=setInterval(calc,1000);return()=>clearInterval(iv)
  },[appt])
  return<span style={{fontVariantNumeric:'tabular-nums'}}>{label}</span>
}

// Centered modal
function Modal({children,onClose}){
  return(
    <div style={{position:'fixed',inset:0,zIndex:70,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'fadeIn 0.15s ease'}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:380,background:CARD,borderRadius:20,border:`1px solid ${BORDER}`,maxHeight:'85dvh',overflowY:'auto',animation:'slideUp 0.2s ease',...F}} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// Client detail modal
function ClientModal({appt,allAppts,onClose,onReschedule,onCancel}){
  const{formatTime}=useTheme()
  if(!appt)return null
  const isNow=new Date()>=apptStart(appt)&&new Date()<=apptEnd(appt)
  const related=allAppts.filter(a=>(appt.clientId&&a.clientId===appt.clientId)||(!appt.clientId&&a.clientPhone&&a.clientPhone===appt.clientPhone&&a.clientPhone)).sort((a,b)=>b.date?.localeCompare(a.date))
  const visits=related.filter(a=>a.bookingStatus==='completed').length
  const spent=related.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)

  return(
    <Modal onClose={onClose}>
      {/* Header */}
      <div style={{padding:'12px 14px',borderBottom:`1px solid ${BORDER}`}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <Avatar name={appt.clientName} photoURL={appt.clientPhotoURL} size={38} fontSize={13}/>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <p style={{color:TXT,fontWeight:700,fontSize:14,margin:0}}>{appt.clientName}</p>
                {appt.isWalkIn&&<WalkInBadge/>}
              </div>
              <StatusBadge status={appt.bookingStatus} isWalkIn={false}/>
            </div>
          </div>
          <button onClick={onClose} style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'5px 6px',color:TXT2,cursor:'pointer',display:'flex'}}><X size={14}/></button>
        </div>
        {isNow&&(
          <div style={{background:`${ORANGE}15`,borderRadius:8,padding:'6px 10px',marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:ORANGE,animation:'pulse 1.5s infinite'}}/>
              <span style={{color:ORANGE,fontWeight:700,fontSize:11}}>NOW SERVING</span>
            </div>
            <span style={{color:ORANGE,fontSize:11,fontWeight:600}}><Countdown appt={appt}/></span>
          </div>
        )}
      </div>

      <div style={{padding:'12px 14px 16px'}}>
        {/* Contact */}
        {(appt.clientEmail||appt.clientPhone)&&(
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:10}}>
            {appt.clientEmail&&<div style={{display:'flex',alignItems:'center',gap:8,background:CARD2,borderRadius:8,padding:'8px 10px'}}><Mail size={11} color={TXT3}/><span style={{color:TXT2,fontSize:12}}>{appt.clientEmail}</span></div>}
            {appt.clientPhone&&<div style={{display:'flex',alignItems:'center',gap:8,background:CARD2,borderRadius:8,padding:'8px 10px'}}><Phone size={11} color={TXT3}/><a href={`tel:${appt.clientPhone}`} style={{color:ORANGE,fontSize:12,textDecoration:'none',fontWeight:600}}>{appt.clientPhone}</a></div>}
          </div>
        )}

        {/* Services */}
        <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:10,padding:'10px 12px',marginBottom:10}}>
          {appt.services?.map((s,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:i<appt.services.length-1?`1px solid ${BORDER}`:'none'}}>
              <div>
                <p style={{color:TXT,fontWeight:600,fontSize:12,margin:'0 0 1px'}}>{s.name}</p>
                <p style={{color:TXT2,fontSize:10,margin:0}}>{formatDuration(s.duration)}</p>
              </div>
              <p style={{color:ORANGE,fontWeight:800,fontSize:13,margin:0}}>{formatCurrency(s.price)}</p>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:6}}>
            <span style={{color:TXT2,fontSize:11}}>{formatTime(appt.startTime)}–{formatTime(appt.endTime)}</span>
            <span style={{color:ORANGE,fontWeight:900,fontSize:14}}>{formatCurrency(appt.totalWithTip||appt.totalPrice)}</span>
          </div>
          {appt.notes&&<p style={{color:TXT2,fontSize:10,margin:'5px 0 0',fontStyle:'italic'}}>"{appt.notes}"</p>}
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
          {[{l:'Visits',v:visits},{l:'Spent',v:formatCurrency(spent)}].map(s=>(
            <div key={s.l} style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
              <p style={{color:ORANGE,fontWeight:900,fontSize:16,margin:'0 0 2px',letterSpacing:'-0.3px'}}>{s.v}</p>
              <p style={{color:TXT3,fontSize:9,margin:0,fontWeight:600}}>{s.l}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        {appt.bookingStatus!=='completed'&&appt.bookingStatus!=='cancelled'&&(
          <div style={{display:'flex',gap:7}}>
            <button onClick={()=>onReschedule(appt)} style={{flex:1,padding:'10px 8px',borderRadius:10,background:CARD2,border:`1px solid ${BORDER}`,color:TXT,fontWeight:600,fontSize:12,cursor:'pointer',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
              <Calendar size={12}/> Reschedule
            </button>
            <button onClick={()=>onCancel(appt)} style={{flex:1,padding:'10px 8px',borderRadius:10,background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.18)',color:'#EF4444',fontWeight:600,fontSize:12,cursor:'pointer',...F}}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// Cancel modal
function CancelModal({appt,onClose,onDone}){
  const[reason,setReason]=useState('');const[saving,setSaving]=useState(false)
  async function confirm(){
    setSaving(true)
    try{await updateDoc(doc(db,'appointments',appt.id),{bookingStatus:'cancelled',cancelReason:reason});onDone()}
    catch{}setSaving(false);onClose()
  }
  return(
    <Modal onClose={onClose}>
      <div style={{padding:'14px 16px 20px'}}>
        <p style={{color:TXT,fontWeight:700,fontSize:15,marginBottom:4}}>Cancel appointment?</p>
        <p style={{color:TXT2,fontSize:12,marginBottom:14}}>{appt.clientName}</p>
        <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason (optional)"
          style={{width:'100%',background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'10px 12px',color:TXT,fontSize:14,outline:'none',marginBottom:12,...F}}/>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:'11px',borderRadius:10,background:'transparent',border:`1px solid ${BORDER}`,color:TXT2,fontWeight:600,cursor:'pointer',...F,fontSize:13}}>Keep</button>
          <button onClick={confirm} disabled={saving} style={{flex:1,padding:'11px',borderRadius:10,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',color:'#EF4444',fontWeight:700,cursor:'pointer',...F,fontSize:13}}>
            {saving?'…':'Cancel it'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Appointment row
function ApptRow({a,onClick,isCurrent,formatTime}){
  const isDone=a.bookingStatus==='completed'
  return(
    <button onClick={onClick}
      style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:12,width:'100%',cursor:'pointer',textAlign:'left',...F,background:isCurrent?`${ORANGE}08`:a.isWalkIn?`${WALKIN}05`:CARD2,border:`1px solid ${isCurrent?`${ORANGE}30`:a.isWalkIn?`${WALKIN}20`:BORDER}`,opacity:isDone?0.45:1,transition:'all 0.12s',marginBottom:6}}>
      <Avatar name={a.clientName} photoURL={a.clientPhotoURL}/>
      <div style={{display:'flex',flexDirection:'column',minWidth:40,flexShrink:0}}>
        <p style={{color:isCurrent?ORANGE:TXT2,fontWeight:700,fontSize:11,margin:0}}>{formatTime(a.startTime)}</p>
        <p style={{color:TXT3,fontSize:10,margin:0}}>{formatTime(a.endTime)}</p>
      </div>
      <div style={{width:1,height:22,background:BORDER,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}>
          <p style={{color:TXT,fontWeight:700,fontSize:13,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.clientName}</p>
          {a.isWalkIn&&<WalkInBadge/>}
        </div>
        <p style={{color:TXT2,fontSize:11,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.services?.map(s=>s.name).join(', ')}</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',flexShrink:0,gap:3}}>
        <p style={{color:ORANGE,fontWeight:800,fontSize:12,margin:0}}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
        <StatusBadge status={a.bookingStatus} isWalkIn={a.isWalkIn}/>
      </div>
      <ChevronRight size={13} color={TXT3}/>
    </button>
  )
}

export default function BarberDashboard(){
  const{barber,appointments,activeServices,availability,loading,todayAppts,upcomingAppts,todayEarned,todayProjected,efficiency}=useBarberData()
  const{formatTime}=useTheme()
  const navigate=useNavigate()

  const[selectedAppt,setSelectedAppt]=useState(null)
  const[cancelAppt,setCancelAppt]=useState(null)

  if(loading)return(
    <BarberLayout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:22,height:22,border:`2px solid #333`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  const now=new Date()
  const currentAppt=todayAppts.find(a=>now>=apptStart(a)&&now<=apptEnd(a))
  const nextAppt=todayAppts.find(a=>apptStart(a)>now)
  const greeting=now.getHours()<12?'Good morning,':now.getHours()<17?'Good afternoon,':'Good evening,'

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100%',paddingBottom:16,...F}}>
        <div style={{padding:'12px 14px',maxWidth:540,margin:'0 auto'}}>

          {/* Header */}
          <div className="fu" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <Avatar name={barber?.name} photoURL={barber?.photoURL} size={40} fontSize={14}/>
              <div>
                <p style={{color:TXT2,fontSize:11,fontWeight:500,margin:'0 0 1px'}}>{greeting}</p>
                <p style={{color:TXT,fontWeight:800,fontSize:18,margin:0,letterSpacing:'-0.4px'}}>{barber?.name?.split(' ')[0]||'Barber'}</p>
              </div>
            </div>
            <div style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'6px 10px',textAlign:'right'}}>
              <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.06em',margin:'0 0 1px'}}>TODAY</p>
              <p style={{color:TXT2,fontSize:10,fontWeight:600,margin:0}}>{format(now,'MMM d, yyyy')}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'12px 14px',marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <p style={{color:TXT,fontWeight:600,fontSize:13,margin:0}}>Today's Overview</p>
              <span style={{color:ORANGE,fontSize:11,fontWeight:700}}>{todayAppts.length} appt{todayAppts.length!==1?'s':''}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {[
                {label:'Appointments',value:todayAppts.length,color:TXT},
                {label:'Earnings',value:formatCurrency(todayEarned),color:GREEN},
                {label:'Efficiency',value:`${efficiency}%`,color:ORANGE},
              ].map(s=>(
                <div key={s.label} style={{background:BG,borderRadius:10,padding:'10px 8px',textAlign:'center'}}>
                  <p style={{color:s.color,fontWeight:900,fontSize:18,margin:'0 0 3px',letterSpacing:'-0.4px'}}>{s.value}</p>
                  <p style={{color:TXT3,fontSize:9,margin:0,fontWeight:600}}>{s.label}</p>
                </div>
              ))}
            </div>
            {(todayEarned+todayProjected)>0&&(
              <div style={{marginTop:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{color:TXT3,fontSize:10,fontWeight:600}}>Earned</span>
                  <span style={{color:TXT2,fontSize:10,fontWeight:600}}>Projected {formatCurrency(todayProjected)}</span>
                </div>
                <div style={{height:3,borderRadius:2,background:BORDER,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:2,background:`linear-gradient(90deg,${ORANGE},#FF8C42)`,width:`${Math.round(todayEarned/(todayEarned+todayProjected)*100)}%`,transition:'width 0.5s'}}/>
                </div>
              </div>
            )}
          </div>

          {/* Now Serving */}
          {currentAppt&&(
            <button className="fu" onClick={()=>setSelectedAppt(currentAppt)}
              style={{width:'100%',background:`linear-gradient(135deg,${ORANGE},#FF8C42)`,borderRadius:16,padding:'14px',marginBottom:10,border:'none',cursor:'pointer',textAlign:'left',...F,boxShadow:`0 6px 24px ${ORANGE}40`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:'rgba(255,255,255,0.9)',animation:'pulse 1.5s infinite'}}/>
                    <span style={{color:'rgba(255,255,255,0.85)',fontSize:9,fontWeight:800,letterSpacing:'0.12em'}}>NOW SERVING</span>
                  </div>
                  <p style={{color:'#fff',fontWeight:900,fontSize:20,margin:'0 0 3px',letterSpacing:'-0.4px'}}>{currentAppt.clientName}</p>
                  <p style={{color:'rgba(255,255,255,0.7)',fontSize:12,margin:'0 0 8px'}}>{currentAppt.services?.map(s=>s.name).join(', ')}</p>
                  <div style={{background:'rgba(0,0,0,0.18)',borderRadius:16,padding:'4px 10px',display:'inline-flex',alignItems:'center',gap:5}}>
                    <Clock size={10} color="rgba(255,255,255,0.85)"/>
                    <span style={{color:'rgba(255,255,255,0.9)',fontWeight:700,fontSize:11}}><Countdown appt={currentAppt}/></span>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <p style={{color:'#fff',fontWeight:900,fontSize:22,margin:'0 0 3px',letterSpacing:'-0.5px'}}>{formatCurrency(currentAppt.totalPrice)}</p>
                  <p style={{color:'rgba(255,255,255,0.6)',fontSize:11}}>{formatTime(currentAppt.startTime)}–{formatTime(currentAppt.endTime)}</p>
                </div>
              </div>
            </button>
          )}

          {/* Next Up */}
          {!currentAppt&&nextAppt&&(
            <button className="fu" onClick={()=>setSelectedAppt(nextAppt)}
              style={{width:'100%',background:CARD,border:`1px solid ${BORDER}`,borderLeft:`3px solid ${ORANGE}`,borderRadius:12,padding:'12px 14px',marginBottom:10,cursor:'pointer',textAlign:'left',...F}}>
              <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:4}}>NEXT UP</p>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <p style={{color:TXT,fontWeight:700,fontSize:13,margin:'0 0 2px'}}>{nextAppt.clientName}</p>
                  <p style={{color:TXT2,fontSize:11,margin:0}}>{formatTime(nextAppt.startTime)} · {nextAppt.services?.map(s=>s.name).join(', ')}</p>
                </div>
                <div style={{textAlign:'right'}}>
                  <p style={{color:ORANGE,fontWeight:800,fontSize:14,margin:'0 0 2px'}}>{formatCurrency(nextAppt.totalPrice)}</p>
                  <p style={{color:TXT3,fontSize:10,margin:0}}><Countdown appt={nextAppt}/></p>
                </div>
              </div>
            </button>
          )}

          {/* Today's Appointments */}
          <div className="fu" style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <p style={{color:TXT,fontWeight:700,fontSize:14,margin:0}}>Today</p>
              <button onClick={()=>navigate('/barber/calendar')}
                style={{color:ORANGE,fontSize:11,fontWeight:700,background:'none',border:'none',cursor:'pointer',...F,display:'flex',alignItems:'center',gap:2}}>
                View all <ChevronRight size={12}/>
              </button>
            </div>

            {todayAppts.length===0?(
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'20px',textAlign:'center'}}>
                <Scissors size={20} style={{color:TXT3,display:'block',margin:'0 auto 7px'}} strokeWidth={1.5}/>
                <p style={{color:TXT2,fontWeight:600,fontSize:12,margin:'0 0 2px'}}>No appointments today</p>
                <p style={{color:TXT3,fontSize:11,margin:0}}>Tap "New" to add a walk-in</p>
              </div>
            ):(
              todayAppts.map(a=>(
                <ApptRow key={a.id} a={a} onClick={()=>setSelectedAppt(a)} isCurrent={currentAppt?.id===a.id} formatTime={formatTime}/>
              ))
            )}
          </div>

          {/* New Appointment button */}
          <button className="fu" onClick={()=>navigate('/barber/calendar')}
            style={{width:'100%',background:ORANGE,color:'#fff',border:'none',borderRadius:22,padding:'14px',fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7,...F,boxShadow:`0 4px 18px ${ORANGE}40`,marginBottom:10}}>
            <Plus size={16}/> New Appointment
          </button>

          {/* Upcoming */}
          {upcomingAppts.slice(0,5).length>0&&(
            <div className="fu" style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'12px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <p style={{color:TXT,fontWeight:700,fontSize:13,margin:0}}>Upcoming</p>
                <TrendingUp size={14} color={TXT3}/>
              </div>
              {upcomingAppts.slice(0,5).map((a,i)=>{
                const d=parseLocalDate(a.date)
                const label=isToday(d)?'Today':isTomorrow(d)?'Tomorrow':format(d,'MMM d')
                return(
                  <button key={a.id} onClick={()=>setSelectedAppt(a)}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:i<Math.min(upcomingAppts.length,5)-1?`1px solid ${BORDER}`:'none',background:'transparent',border:'none',cursor:'pointer',textAlign:'left',...F,width:'100%'}}>
                    <Avatar name={a.clientName} photoURL={a.clientPhotoURL} size={30} fontSize={10}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <p style={{color:TXT,fontWeight:700,fontSize:12,margin:'0 0 1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.clientName}</p>
                        {a.isWalkIn&&<WalkInBadge/>}
                      </div>
                      <p style={{color:TXT2,fontSize:11,margin:0}}>{label} · {formatTime(a.startTime)}</p>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                      <p style={{color:ORANGE,fontWeight:800,fontSize:12,margin:0}}>{formatCurrency(a.totalPrice)}</p>
                      <StatusBadge status={a.bookingStatus} isWalkIn={a.isWalkIn}/>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selectedAppt&&(
        <ClientModal appt={selectedAppt} allAppts={appointments}
          onClose={()=>setSelectedAppt(null)}
          onReschedule={a=>{setSelectedAppt(null);navigate('/barber/calendar',{state:{rescheduleId:a.id}})}}
          onCancel={a=>{setSelectedAppt(null);setCancelAppt(a)}}/>
      )}
      {cancelAppt&&<CancelModal appt={cancelAppt} onClose={()=>setCancelAppt(null)} onDone={()=>setCancelAppt(null)}/>}
    </BarberLayout>
  )
}