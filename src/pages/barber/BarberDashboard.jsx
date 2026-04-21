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
import { Clock, X, Scissors, Phone, Mail, Calendar } from 'lucide-react'

const F  = { fontFamily:'Monda,sans-serif' }
const SC = { pending:'var(--accent)', confirmed:'#22C55E', completed:'var(--text-sec)', cancelled:'#EF4444' }

function formatPhone(raw) {
  if (!raw) return null
  const d = raw.replace(/\D/g,'')
  if (d.length===10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`
  if (d.length===11&&d[0]==='1') return `+1 ${d.slice(1,4)}-${d.slice(4,7)}-${d.slice(7)}`
  return raw
}

function apptEnd(a)   { const [y,m,d]=a.date.split('-').map(Number),[h,mn]=a.endTime.split(':').map(Number); return new Date(y,m-1,d,h,mn,0) }
function apptStart(a) { const [y,m,d]=a.date.split('-').map(Number),[h,mn]=a.startTime.split(':').map(Number); return new Date(y,m-1,d,h,mn,0) }

function NextCountdown({ appt }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    function calc() {
      const start=apptStart(appt), end=apptEnd(appt), now=new Date()
      if (now>=start&&now<=end) { const s=differenceInSeconds(end,now),m=Math.floor(s/60),sec=s%60; setLabel(`${m}:${String(sec).padStart(2,'0')} remaining`); return }
      if (now<start) { const s=differenceInSeconds(start,now),m=Math.floor(s/60); setLabel(m>=60?`in ${Math.floor(m/60)}h ${m%60}m`:`in ${m}m`) }
    }
    calc(); const iv=setInterval(calc,1000); return ()=>clearInterval(iv)
  },[appt])
  return <span style={{fontVariantNumeric:'tabular-nums'}}>{label}</span>
}

function TipModal({ appt, onClose }) {
  const [tip,setTip]=useState(''); const [pay,setPay]=useState(appt?.paymentMethod||'Cash'); const [saving,setSaving]=useState(false)
  const methods=['Cash','Square','Cash App','Zelle','Other']
  async function save() { setSaving(true); const t=parseFloat(tip)||0; try { await updateDoc(doc(db,'appointments',appt.id),{tip:t,totalWithTip:(appt.totalPrice||0)+t,paymentMethod:pay.toLowerCase(),paymentStatus:'paid',bookingStatus:'completed'}); onClose() } catch {} setSaving(false) }
  async function skip() { try { await updateDoc(doc(db,'appointments',appt.id),{tip:0,totalWithTip:appt.totalPrice||0,paymentMethod:pay.toLowerCase(),paymentStatus:'paid',bookingStatus:'completed'}) } catch {} onClose() }
  if(!appt) return null
  return (
    <div style={{position:'fixed',inset:0,zIndex:80,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:480,background:'var(--surface)',borderRadius:'24px 24px 0 0',border:'1px solid var(--border)',padding:'24px 20px 40px',...F}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <p style={{color:'var(--text-sec)',fontSize:11,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 4px'}}>APPOINTMENT COMPLETE</p>
            <p style={{color:'var(--text-pri)',fontWeight:800,fontSize:18,margin:0}}>{appt.clientName}</p>
            <p style={{color:'var(--text-sec)',fontSize:13,margin:'2px 0 0'}}>{appt.services?.map(s=>s.name).join(', ')} · {formatCurrency(appt.totalPrice)}</p>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text-sec)',cursor:'pointer'}}><X size={20}/></button>
        </div>
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:'16px',marginBottom:16}}>
          <p style={{color:'var(--text-sec)',fontSize:11,fontWeight:700,letterSpacing:'0.08em',marginBottom:12}}>TIP?</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
            {['0','5','10','15','20'].map(a=><button key={a} onClick={()=>setTip(a)} style={{padding:'8px 14px',borderRadius:20,border:`1.5px solid ${tip===a?'var(--accent)':'var(--border)'}`,background:tip===a?'var(--accent)':'transparent',color:tip===a?'var(--accent-inv)':'var(--text-sec)',fontWeight:700,fontSize:13,cursor:'pointer',...F}}>{a==='0'?'No tip':`$${a}`}</button>)}
          </div>
          <div style={{borderBottom:'1.5px solid var(--border)',paddingBottom:8}}><input type="number" value={tip} onChange={e=>setTip(e.target.value)} placeholder="Custom" style={{width:'100%',background:'transparent',border:'none',outline:'none',color:'var(--text-pri)',fontSize:16,...F}}/></div>
        </div>
        <div style={{marginBottom:18}}>
          <p style={{color:'var(--text-sec)',fontSize:11,fontWeight:700,letterSpacing:'0.08em',marginBottom:10}}>PAYMENT METHOD</p>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{methods.map(m=><button key={m} onClick={()=>setPay(m)} style={{padding:'7px 13px',borderRadius:20,border:`1.5px solid ${pay===m?'var(--accent)':'var(--border)'}`,background:pay===m?'var(--accent)':'transparent',color:pay===m?'var(--accent-inv)':'var(--text-sec)',fontWeight:700,fontSize:12,cursor:'pointer',...F}}>{m}</button>)}</div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderTop:'1px solid var(--border)',marginBottom:14}}>
          <span style={{color:'var(--text-sec)',fontSize:14}}>Total</span>
          <span style={{color:'var(--accent)',fontWeight:900,fontSize:18}}>{formatCurrency((appt.totalPrice||0)+(parseFloat(tip)||0))}</span>
        </div>
        <button onClick={save} disabled={saving} style={{width:'100%',background:'var(--accent)',color:'var(--accent-inv)',border:'none',borderRadius:14,padding:'15px',fontWeight:700,fontSize:16,cursor:'pointer',...F,marginBottom:10}}>{saving?'Saving…':'Mark as Paid'}</button>
        <button onClick={skip} style={{width:'100%',background:'none',border:'none',color:'var(--text-sec)',fontSize:14,cursor:'pointer',...F}}>Skip</button>
      </div>
    </div>
  )
}

function ClientModal({ appt, allAppts, onClose, onReschedule, onCancel }) {
  const [clientData,setClientData]=useState(null); const [showAll,setShowAll]=useState(false); const {formatTime}=useTheme()
  useEffect(()=>{ if(!appt?.clientId)return; getDoc(doc(db,'users',appt.clientId)).then(s=>s.exists()&&setClientData(s.data())) },[appt])
  if(!appt) return null
  const isNow=new Date()>=apptStart(appt)&&new Date()<=apptEnd(appt)
  const related=allAppts.filter(a=>(appt.clientId&&a.clientId===appt.clientId)||(!appt.clientId&&a.clientEmail===appt.clientEmail&&a.clientEmail)).sort((a,b)=>b.date?.localeCompare(a.date))
  const visits=related.filter(a=>a.bookingStatus==='completed').length
  const spent=related.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const svcCount={}; related.forEach(a=>a.services?.forEach(s=>{svcCount[s.name]=(svcCount[s.name]||0)+1}))
  const topSvc=Object.entries(svcCount).sort((a,b)=>b[1]-a[1])[0]
  const phone=formatPhone(appt.clientPhone)
  const items=showAll?related:related.slice(0,5)
  return (
    <div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:560,background:'var(--surface)',borderRadius:'20px 20px 0 0',border:'1px solid var(--border)',maxHeight:'90vh',overflowY:'auto',...F}} onClick={e=>e.stopPropagation()}>
        {isNow&&<div style={{background:'var(--accent)',padding:'10px 20px',borderRadius:'20px 20px 0 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:7,height:7,borderRadius:'50%',background:'var(--accent-inv)',animation:'pulse 1.5s infinite'}}/><span style={{color:'var(--accent-inv)',fontWeight:800,fontSize:13}}>NOW SERVING</span></div><span style={{color:'var(--accent-inv)',fontWeight:700,fontSize:13}}><NextCountdown appt={appt}/></span></div>}
        <div style={{padding:'20px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:50,height:50,borderRadius:'50%',overflow:'hidden',background:'var(--card)',border:`2px solid ${isNow?'var(--accent)':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16,color:'var(--text-pri)',flexShrink:0}}>
                {(clientData?.photoURL||appt.clientPhotoURL)?<img src={clientData?.photoURL||appt.clientPhotoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:appt.clientName?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div>
                <p style={{color:'var(--text-pri)',fontWeight:800,fontSize:17,margin:'0 0 3px'}}>{appt.clientName}</p>
                {appt.isGuest&&<span style={{background:'var(--card)',color:'var(--text-sec)',fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:700,border:'1px solid var(--border)'}}>Guest</span>}
              </div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',color:'var(--text-sec)',cursor:'pointer'}}><X size={20}/></button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
            {appt.clientEmail&&<div style={{display:'flex',alignItems:'center',gap:8}}><Mail size={13} color="var(--text-sec)"/><span style={{color:'var(--text-sec)',fontSize:13}}>{appt.clientEmail}</span></div>}
            {phone&&<div style={{display:'flex',alignItems:'center',gap:8}}><Phone size={13} color="var(--text-sec)"/><a href={`tel:${appt.clientPhone}`} style={{color:'var(--accent)',fontSize:13,textDecoration:'none',fontWeight:600}}>{phone}</a></div>}
          </div>
          <div style={{background:'var(--card)',border:`1.5px solid ${isNow?'var(--accent)44':'var(--border)'}`,borderRadius:14,padding:12,marginBottom:14}}>
            <p style={{color:'var(--text-sec)',fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:8}}>APPOINTMENT</p>
            {appt.services?.map((s,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:i<appt.services.length-1?8:0}}><div style={{width:28,height:28,borderRadius:7,background:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Scissors size={12} color="var(--text-sec)"/></div><div style={{flex:1}}><p style={{color:'var(--text-pri)',fontWeight:700,fontSize:14,margin:'0 0 1px'}}>{s.name}</p><p style={{color:'var(--text-sec)',fontSize:12,margin:0}}>{formatDuration(s.duration)}</p></div><p style={{color:'var(--accent)',fontWeight:800,fontSize:14,flexShrink:0}}>{formatCurrency(s.price)}</p></div>)}
            <div style={{height:1,background:'var(--border)',margin:'10px 0'}}/>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <span style={{color:'var(--text-sec)',fontSize:13}}>{formatTime(appt.startTime)} – {formatTime(appt.endTime)} · {formatDuration(appt.totalDuration)}</span>
              <span style={{color:'var(--accent)',fontWeight:900,fontSize:15}}>{formatCurrency(appt.totalWithTip||appt.totalPrice)}</span>
            </div>
            {appt.tip>0&&<p style={{color:'#22C55E',fontSize:12,margin:'6px 0 0'}}>+{formatCurrency(appt.tip)} tip</p>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
            {[{l:'Visits',v:visits},{l:'Spent',v:formatCurrency(spent)},{l:'Favorite',v:topSvc?topSvc[0]:'—',sm:true}].map(s=>(
              <div key={s.l} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:'9px 6px',textAlign:'center'}}>
                <p style={{color:'var(--accent)',fontWeight:900,fontSize:s.sm?11:16,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.v}</p>
                <p style={{color:'var(--text-sec)',fontSize:10,margin:0}}>{s.l}</p>
              </div>
            ))}
          </div>
          {related.length>1&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <p style={{color:'var(--text-sec)',fontSize:11,fontWeight:700,letterSpacing:'0.08em',margin:0}}>HISTORY ({related.length})</p>
                {related.length>5&&<button onClick={()=>setShowAll(p=>!p)} style={{background:'none',border:'none',color:'var(--accent)',fontSize:11,fontWeight:700,cursor:'pointer',...F}}>{showAll?'Less':'All'}</button>}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                {items.map(a=>(
                  <div key={a.id} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',background:'var(--card)',border:'1px solid var(--border)',borderLeft:`3px solid ${SC[a.bookingStatus]||'var(--border)'}`,borderRadius:10,opacity:a.id===appt.id?1:0.65}}>
                    <div>
                      <p style={{color:a.id===appt.id?'var(--text-pri)':'var(--text-sec)',fontWeight:a.id===appt.id?700:500,fontSize:12,margin:'0 0 1px'}}>{a.date?format(parseLocalDate(a.date),'MMM d, yyyy'):'—'}{a.id===appt.id?' ← today':''}</p>
                      <p style={{color:'var(--text-sec)',fontSize:11,margin:0}}>{a.services?.map(s=>s.name).join(', ')}</p>
                    </div>
                    <p style={{color:a.paymentStatus==='paid'?'#22C55E':'var(--text-sec)',fontWeight:700,fontSize:12}}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {appt.bookingStatus!=='completed'&&appt.bookingStatus!=='cancelled'&&(
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button onClick={()=>onReschedule(appt)} style={{flex:1,padding:'12px',borderRadius:13,background:'var(--card)',border:'1px solid var(--border)',color:'var(--text-pri)',fontWeight:600,fontSize:13,cursor:'pointer',...F,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}><Calendar size={13}/> Reschedule</button>
              <button onClick={()=>onCancel(appt)} style={{flex:1,padding:'12px',borderRadius:13,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',color:'#EF4444',fontWeight:600,fontSize:13,cursor:'pointer',...F}}>Cancel</button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}

function CancelModal({ appt, onClose, onDone }) {
  const [reason,setReason]=useState(''); const [saving,setSaving]=useState(false)
  async function confirm() { setSaving(true); try { await updateDoc(doc(db,'appointments',appt.id),{bookingStatus:'cancelled',cancelReason:reason}); onDone() } catch {} setSaving(false); onClose() }
  return (
    <div style={{position:'fixed',inset:0,zIndex:70,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:360,background:'var(--surface)',borderRadius:20,border:'1px solid var(--border)',padding:24,...F}} onClick={e=>e.stopPropagation()}>
        <p style={{color:'var(--text-pri)',fontWeight:800,fontSize:17,marginBottom:8}}>Cancel appointment?</p>
        <p style={{color:'var(--text-sec)',fontSize:14,marginBottom:14}}>{appt.clientName} · {appt.startTime}</p>
        <div style={{borderBottom:'1.5px solid var(--border)',paddingBottom:8,marginBottom:16}}><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason (optional)" style={{width:'100%',background:'transparent',border:'none',outline:'none',color:'var(--text-pri)',fontSize:16,...F}}/></div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'13px',borderRadius:13,background:'transparent',border:'1px solid var(--border)',color:'var(--text-sec)',fontWeight:600,cursor:'pointer',...F}}>Keep it</button>
          <button onClick={confirm} disabled={saving} style={{flex:1,padding:'13px',borderRadius:13,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',color:'#EF4444',fontWeight:700,cursor:'pointer',...F}}>{saving?'Cancelling…':'Yes, Cancel'}</button>
        </div>
      </div>
    </div>
  )
}

export default function BarberDashboard() {
  const { user }=useAuth(); const {formatTime}=useTheme(); const navigate=useNavigate()
  const [barber,setBarber]=useState(null); const [allAppts,setAllAppts]=useState([]); const [loading,setLoading]=useState(true)
  const [selectedAppt,setSelectedAppt]=useState(null); const [tipAppt,setTipAppt]=useState(null); const [cancelAppt,setCancelAppt]=useState(null)

  useEffect(()=>{ window.scrollTo(0,0) },[])

  async function autoComplete(appts) {
    const now=new Date(); const done=appts.filter(a=>{ if(a.bookingStatus!=='confirmed'&&a.bookingStatus!=='pending')return false; return apptEnd(a)<now })
    for(const a of done){try{await updateDoc(doc(db,'appointments',a.id),{bookingStatus:'completed'})}catch{}}
    const today=format(new Date(),'yyyy-MM-dd'); const just=done.filter(a=>a.date===today&&a.paymentStatus!=='paid')
    if(just.length>0&&!tipAppt)setTipAppt(just[0])
  }

  useEffect(()=>{ if(!user)return; getDocs(query(collection(db,'barbers'),where('userId','==',user.uid))).then(s=>{ if(!s.empty)setBarber({id:s.docs[0].id,...s.docs[0].data()}); else setLoading(false) }) },[user])
  useEffect(()=>{ if(!barber)return; const q=query(collection(db,'appointments'),where('barberId','==',barber.id)); const unsub=onSnapshot(q,snap=>{ const all=snap.docs.map(d=>({id:d.id,...d.data()})); setAllAppts(all); setLoading(false); autoComplete(all) }); return unsub },[barber])

  if(loading) return <BarberLayout><PageLoader/></BarberLayout>

  const today=format(new Date(),'yyyy-MM-dd'), now=new Date()
  const active=allAppts.filter(a=>a.bookingStatus!=='cancelled')
  const todayAppts=active.filter(a=>a.date===today).sort((a,b)=>a.startTime.localeCompare(b.startTime))
  const todayEarned=todayAppts.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)
  const todayProjected=todayAppts.filter(a=>a.paymentStatus!=='paid'&&a.bookingStatus!=='cancelled').reduce((s,a)=>s+(a.totalPrice||0),0)
  const todayTips=todayAppts.reduce((s,a)=>s+(a.tip||0),0)
  const currentAppt=todayAppts.find(a=>now>=apptStart(a)&&now<=apptEnd(a))
  const nextAppt=todayAppts.find(a=>apptStart(a)>now)
  const upcoming=active.filter(a=>a.date>today).sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)).slice(0,5)

  function handleReschedule(appt) { setSelectedAppt(null); navigate('/barber/calendar',{state:{rescheduleId:appt.id}}) }

  return (
    <BarberLayout>
      <div style={{padding:'16px 20px',maxWidth:640,margin:'0 auto',...F}}>
        {/* Greeting — minimal */}
        <div style={{marginBottom:16}}>
          <p style={{color:'var(--text-sec)',fontSize:11,fontWeight:500,letterSpacing:'0.03em',margin:0}}>{now.getHours()<12?'morning':now.getHours()<17?'afternoon':'evening'} · {format(now,'EEE, MMM d')}</p>
          <p style={{color:'var(--text-pri)',fontSize:20,fontWeight:800,margin:'2px 0 0',letterSpacing:'-0.2px'}}>{barber?.name||'Dashboard'}</p>
        </div>

        {currentAppt&&(
          <button onClick={()=>setSelectedAppt(currentAppt)}
            style={{width:'100%',background:'var(--accent)',borderRadius:16,padding:'14px 16px',marginBottom:12,border:'none',cursor:'pointer',textAlign:'left',...F}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}><div style={{width:6,height:6,borderRadius:'50%',background:'var(--accent-inv)',animation:'pulse 1.5s infinite'}}/><span style={{color:'var(--accent-inv)',fontSize:10,fontWeight:800,letterSpacing:'0.12em',opacity:0.75}}>NOW SERVING</span></div>
                <p style={{color:'var(--accent-inv)',fontWeight:900,fontSize:19,margin:'0 0 2px'}}>{currentAppt.clientName}</p>
                <p style={{color:'var(--accent-inv)',opacity:0.7,fontSize:13,margin:'0 0 6px'}}>{currentAppt.services?.map(s=>s.name).join(', ')}</p>
                <div style={{background:'rgba(0,0,0,0.18)',borderRadius:20,padding:'4px 12px',display:'inline-flex',alignItems:'center',gap:5}}>
                  <Clock size={11} color="var(--accent-inv)"/>
                  <span style={{color:'var(--accent-inv)',fontWeight:700,fontSize:12}}><NextCountdown appt={currentAppt}/></span>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{color:'var(--accent-inv)',fontWeight:900,fontSize:21,margin:'0 0 3px'}}>{formatCurrency(currentAppt.totalPrice)}</p>
                <p style={{color:'var(--accent-inv)',opacity:0.6,fontSize:12}}>{formatTime(currentAppt.startTime)} – {formatTime(currentAppt.endTime)}</p>
              </div>
            </div>
          </button>
        )}

        {!currentAppt&&nextAppt&&(
          <button onClick={()=>setSelectedAppt(nextAppt)}
            style={{width:'100%',background:'var(--card)',border:`1px solid var(--border)`,borderLeft:'3px solid var(--accent)',borderRadius:13,padding:'12px 14px',marginBottom:12,cursor:'pointer',textAlign:'left',...F}}>
            <p style={{color:'var(--text-sec)',fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:4}}>NEXT UP</p>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div>
                <p style={{color:'var(--text-pri)',fontWeight:700,fontSize:14,margin:'0 0 2px'}}>{nextAppt.clientName}</p>
                <p style={{color:'var(--text-sec)',fontSize:12,margin:0}}>{formatTime(nextAppt.startTime)} · {nextAppt.services?.map(s=>s.name).join(', ')}</p>
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{color:'var(--accent)',fontWeight:800,fontSize:14,margin:'0 0 2px'}}>{formatCurrency(nextAppt.totalPrice)}</p>
                <p style={{color:'var(--text-sec)',fontSize:11}}><NextCountdown appt={nextAppt}/></p>
              </div>
            </div>
          </button>
        )}

        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:14,padding:'13px 15px',marginBottom:12}}>
          <p style={{color:'var(--text-sec)',fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:11}}>TODAY — {format(new Date(),'MMMM d')}</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            <div style={{textAlign:'center'}}><p style={{color:'#22C55E',fontWeight:900,fontSize:19,margin:'0 0 2px'}}>{formatCurrency(todayEarned)}</p><p style={{color:'var(--text-sec)',fontSize:10,margin:0}}>Earned</p></div>
            <div style={{textAlign:'center',borderLeft:'1px solid var(--border)',borderRight:'1px solid var(--border)'}}><p style={{color:'var(--accent)',fontWeight:900,fontSize:19,margin:'0 0 2px'}}>{formatCurrency(todayProjected)}</p><p style={{color:'var(--text-sec)',fontSize:10,margin:0}}>Projected</p></div>
            <div style={{textAlign:'center'}}><p style={{color:'#22C55E',fontWeight:900,fontSize:19,margin:'0 0 2px'}}>{formatCurrency(todayTips)}</p><p style={{color:'var(--text-sec)',fontSize:10,margin:0}}>Tips</p></div>
          </div>
          {(todayEarned+todayProjected)>0&&<div style={{marginTop:10,height:3,borderRadius:2,background:'var(--border)',overflow:'hidden'}}><div style={{height:'100%',borderRadius:2,background:'#22C55E',width:`${Math.round(todayEarned/(todayEarned+todayProjected)*100)}%`,transition:'width 0.5s'}}/></div>}
        </div>

        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:14,padding:'13px 15px',marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <p style={{color:'var(--text-pri)',fontWeight:800,fontSize:14,margin:0}}>Today's Schedule</p>
            <span style={{background:'var(--surface)',color:'var(--text-sec)',fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:20,border:'1px solid var(--border)'}}>{todayAppts.length}</span>
          </div>
          {todayAppts.length===0?<p style={{color:'var(--text-sec)',fontSize:13,textAlign:'center',padding:'12px 0'}}>No appointments today</p>:(
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {todayAppts.map(a=>{
                const isCur=currentAppt?.id===a.id, isDone=a.bookingStatus==='completed'
                return (
                  <button key={a.id} onClick={()=>setSelectedAppt(a)}
                    style={{display:'flex',alignItems:'center',gap:9,padding:'9px 10px',borderRadius:11,background:isCur?'var(--accent)12':'var(--bg)',border:`1px solid ${isCur?'var(--accent)44':'var(--border)'}`,cursor:'pointer',textAlign:'left',...F,width:'100%',opacity:isDone?0.5:1}}>
                    <div style={{width:34,height:34,borderRadius:'50%',overflow:'hidden',background:'var(--card)',border:`1.5px solid ${isCur?'var(--accent)':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:11,color:'var(--text-sec)',flexShrink:0}}>
                      {a.clientPhotoURL?<img src={a.clientPhotoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:a.clientName?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
                    </div>
                    <div style={{flexShrink:0,textAlign:'center',minWidth:38}}>
                      <p style={{color:isCur?'var(--accent)':'var(--text-sec)',fontWeight:700,fontSize:11,margin:0}}>{formatTime(a.startTime)}</p>
                      <p style={{color:'var(--text-sec)',fontSize:10,margin:0}}>{formatTime(a.endTime)}</p>
                    </div>
                    <div style={{width:1,height:26,background:'var(--border)',flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{color:'var(--text-pri)',fontWeight:700,fontSize:13,margin:'0 0 1px'}}>{a.clientName}</p>
                      <p style={{color:'var(--text-sec)',fontSize:11,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.services?.map(s=>s.name).join(', ')}</p>
                    </div>
                    <div style={{flexShrink:0,textAlign:'right'}}>
                      <p style={{color:'var(--accent)',fontWeight:800,fontSize:12,margin:'0 0 2px'}}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
                      <div style={{width:6,height:6,borderRadius:'50%',background:SC[a.bookingStatus]||'var(--border)',marginLeft:'auto'}}/>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {upcoming.length>0&&(
          <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:14,padding:'13px 15px'}}>
            <p style={{color:'var(--text-pri)',fontWeight:800,fontSize:14,marginBottom:10}}>Upcoming</p>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {upcoming.map(a=>{
                const d=parseLocalDate(a.date), label=isToday(d)?'Today':isTomorrow(d)?'Tomorrow':format(d,'MMM d')
                return <button key={a.id} onClick={()=>setSelectedAppt(a)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 10px',borderRadius:11,background:'var(--bg)',border:'1px solid var(--border)',cursor:'pointer',textAlign:'left',...F,width:'100%'}}>
                  <div style={{flex:1,minWidth:0}}><p style={{color:'var(--text-pri)',fontWeight:700,fontSize:13,margin:'0 0 1px'}}>{a.clientName}</p><p style={{color:'var(--text-sec)',fontSize:12,margin:0}}>{label} · {formatTime(a.startTime)}</p></div>
                  <p style={{color:'var(--accent)',fontWeight:800,fontSize:13,margin:0,flexShrink:0}}>{formatCurrency(a.totalPrice)}</p>
                </button>
              })}
            </div>
          </div>
        )}
      </div>

      {selectedAppt&&<ClientModal appt={selectedAppt} allAppts={allAppts} onClose={()=>setSelectedAppt(null)} onReschedule={handleReschedule} onCancel={a=>{setSelectedAppt(null);setCancelAppt(a)}}/>}
      {tipAppt&&<TipModal appt={tipAppt} onClose={()=>setTipAppt(null)}/>}
      {cancelAppt&&<CancelModal appt={cancelAppt} onClose={()=>setCancelAppt(null)} onDone={()=>setCancelAppt(null)}/>}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </BarberLayout>
  )
}