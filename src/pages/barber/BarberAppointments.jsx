import { useState, useMemo } from 'react'
import { format, isToday, isTomorrow } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration, parseLocalDate } from '../../utils/helpers'
import { useTheme } from '../../context/ThemeContext'
import BarberLayout from '../../components/layout/BarberLayout'
import { Search, Plus, ChevronRight, X, Scissors } from 'lucide-react'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A'),WALKIN=('#7C3AED')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

const STATUS={
  confirmed:{bg:'rgba(34,197,94,0.12)',c:'#22C55E',l:'Confirmed'},
  pending:{bg:`${ORANGE}14`,c:ORANGE,l:'Pending'},
  completed:{bg:'rgba(255,255,255,0.05)',c:TXT2,l:'Done'},
  cancelled:{bg:'rgba(239,68,68,0.1)',c:'#EF4444',l:'Cancelled'},
}

function parseLocalDate2(s){if(!s)return new Date();const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}

function StatusBadge({status,isWalkIn}){
  if(isWalkIn&&status!=='cancelled'&&status!=='completed')
    return<span style={{background:`${WALKIN}18`,color:WALKIN,fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:20,whiteSpace:'nowrap'}}>Walk-in</span>
  const s=STATUS[status]||STATUS.pending
  return<span style={{background:s.bg,color:s.c,fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:20,whiteSpace:'nowrap'}}>{s.l}</span>
}

function Avatar({name,photoURL,size=36,fontSize=11}){
  const i=name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?'
  return(
    <div style={{width:size,height:size,borderRadius:'50%',overflow:'hidden',background:CARD2,border:`1.5px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize,color:TXT2,flexShrink:0}}>
      {photoURL?<img src={photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:i}
    </div>
  )
}

function DateLabel({dateStr}){
  const d=parseLocalDate2(dateStr)
  if(isToday(d))return<span style={{color:ORANGE,fontWeight:700}}>Today</span>
  if(isTomorrow(d))return<span style={{color:'#22C55E',fontWeight:700}}>Tomorrow</span>
  return<span>{format(d,'MMM d, yyyy')}</span>
}

function ApptCard({appt,onClick,formatTime}){
  const s=STATUS[appt.bookingStatus]||STATUS.pending
  return(
    <button onClick={onClick} className="fu"
      style={{width:'100%',textAlign:'left',cursor:'pointer',...F,background:appt.isWalkIn?`${WALKIN}05`:CARD2,border:`1px solid ${appt.isWalkIn?`${WALKIN}20`:BORDER}`,borderLeft:`3px solid ${appt.isWalkIn?WALKIN:s.c}`,borderRadius:12,padding:'11px 12px',marginBottom:6,display:'flex',alignItems:'center',gap:10,transition:'all 0.12s'}}>
      <Avatar name={appt.clientName} photoURL={appt.clientPhotoURL}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
          <p style={{color:TXT,fontWeight:700,fontSize:13,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.clientName}</p>
          {appt.isWalkIn&&<span style={{background:`${WALKIN}18`,color:WALKIN,fontSize:8,fontWeight:800,padding:'1px 5px',borderRadius:8,flexShrink:0}}>W</span>}
        </div>
        <p style={{color:TXT2,fontSize:11,margin:'0 0 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{appt.services?.map(s=>s.name).join(', ')}</p>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{color:TXT3,fontSize:10}}><DateLabel dateStr={appt.date}/></span>
          <span style={{color:TXT3,fontSize:10}}>·</span>
          <span style={{color:TXT3,fontSize:10}}>{formatTime?formatTime(appt.startTime):appt.startTime}</span>
          {appt.totalDuration&&<><span style={{color:TXT3,fontSize:10}}>·</span><span style={{color:TXT3,fontSize:10}}>{formatDuration(appt.totalDuration)}</span></>}
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
        <p style={{color:ORANGE,fontWeight:800,fontSize:13,margin:0}}>{formatCurrency(appt.totalWithTip||appt.totalPrice)}</p>
        <StatusBadge status={appt.bookingStatus} isWalkIn={appt.isWalkIn}/>
      </div>
      <ChevronRight size={13} color={TXT3} style={{flexShrink:0}}/>
    </button>
  )
}

function DateGroup({dateStr,children}){
  const d=parseLocalDate2(dateStr)
  let label=format(d,'MMMM d, yyyy')
  if(isToday(d))label=`Today · ${format(d,'MMM d')}`
  if(isTomorrow(d))label=`Tomorrow · ${format(d,'MMM d')}`
  return(
    <div style={{marginBottom:12}}>
      <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.08em',marginBottom:6,paddingLeft:2}}>{label.toUpperCase()}</p>
      {children}
    </div>
  )
}

export default function BarberAppointments(){
  // ✅ No Firebase calls — reads from global cache
  const{appointments,loading,today}=useBarberData()
  const{formatTime}=useTheme()
  const navigate=useNavigate()

  const[tab,setTab]=useState('upcoming')
  const[search,setSearch]=useState('')
  const[showSearch,setShowSearch]=useState(false)

  const filtered=useMemo(()=>{
    let list=[]
    if(tab==='upcoming'){
      list=appointments.filter(a=>a.bookingStatus!=='cancelled'&&a.bookingStatus!=='completed'&&a.date>=today)
      list.sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime))
    }else if(tab==='past'){
      list=appointments.filter(a=>a.bookingStatus==='completed'||(a.date<today&&a.bookingStatus!=='cancelled'))
      list.sort((a,b)=>b.date.localeCompare(a.date)||b.startTime.localeCompare(a.startTime))
    }else{
      list=appointments.filter(a=>a.bookingStatus==='cancelled')
      list.sort((a,b)=>b.date.localeCompare(a.date))
    }
    if(search.trim()){
      const s=search.toLowerCase()
      list=list.filter(a=>a.clientName?.toLowerCase().includes(s)||a.services?.some(sv=>sv.name?.toLowerCase().includes(s)))
    }
    return list
  },[appointments,tab,today,search])

  const grouped=useMemo(()=>{
    if(tab!=='upcoming')return null
    const map={}
    filtered.forEach(a=>{if(!map[a.date])map[a.date]=[];map[a.date].push(a)})
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
  },[filtered,tab])

  const TABS=[
    {key:'upcoming',label:'Upcoming',count:appointments.filter(a=>a.bookingStatus!=='cancelled'&&a.bookingStatus!=='completed'&&a.date>=today).length},
    {key:'past',    label:'Past',     count:appointments.filter(a=>a.bookingStatus==='completed'||(a.date<today&&a.bookingStatus!=='cancelled')).length},
    {key:'cancelled',label:'Cancelled',count:appointments.filter(a=>a.bookingStatus==='cancelled').length},
  ]

  if(loading)return(
    <BarberLayout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:22,height:22,border:`2px solid #333`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100%',paddingBottom:16,...F}}>
        <div style={{padding:'12px 14px',maxWidth:540,margin:'0 auto'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <h1 style={{color:TXT,fontWeight:800,fontSize:18,margin:0,letterSpacing:'-0.3px'}}>Appointments</h1>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setShowSearch(p=>!p)}
                style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'6px 7px',color:showSearch?ORANGE:TXT2,cursor:'pointer',display:'flex'}}>
                <Search size={15}/>
              </button>
              <button onClick={()=>navigate('/barber/calendar')}
                style={{background:ORANGE,border:'none',borderRadius:8,padding:'6px 12px',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontWeight:700,fontSize:12,...F,boxShadow:`0 3px 10px ${ORANGE}35`}}>
                <Plus size={13}/> New
              </button>
            </div>
          </div>

          {/* Search */}
          {showSearch&&(
            <div style={{marginBottom:10,display:'flex',alignItems:'center',gap:8,background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:'8px 12px'}}>
              <Search size={13} color={TXT3}/>
              <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search client or service…"
                style={{flex:1,background:'transparent',border:'none',outline:'none',color:TXT,fontSize:14,...F}}/>
              {search&&<button onClick={()=>setSearch('')} style={{background:'none',border:'none',color:TXT3,cursor:'pointer',padding:0,display:'flex'}}><X size={13}/></button>}
            </div>
          )}

          {/* Tabs */}
          <div style={{display:'flex',gap:4,marginBottom:14,background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:3}}>
            {TABS.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                style={{flex:1,padding:'8px 4px',borderRadius:9,border:'none',cursor:'pointer',background:tab===t.key?ORANGE:'transparent',color:tab===t.key?'#fff':TXT2,fontWeight:700,fontSize:11,...F,transition:'all 0.12s',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                {t.label}
                {t.count>0&&<span style={{background:tab===t.key?'rgba(255,255,255,0.25)':CARD2,color:tab===t.key?'#fff':TXT3,fontSize:9,fontWeight:800,borderRadius:8,padding:'1px 5px'}}>{t.count}</span>}
              </button>
            ))}
          </div>

          {/* Content */}
          {filtered.length===0?(
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'32px 16px',textAlign:'center'}}>
              <div style={{fontSize:26,marginBottom:8}}>{tab==='upcoming'?'📅':tab==='past'?'✅':'❌'}</div>
              <p style={{color:TXT2,fontWeight:600,fontSize:13,margin:'0 0 4px'}}>
                {search?'No results':tab==='upcoming'?'No upcoming appointments':tab==='past'?'No past appointments':'No cancelled'}
              </p>
              {tab==='upcoming'&&!search&&(
                <button onClick={()=>navigate('/barber/calendar')}
                  style={{marginTop:12,background:ORANGE,border:'none',borderRadius:20,padding:'9px 20px',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',...F}}>
                  + New Appointment
                </button>
              )}
            </div>
          ):tab==='upcoming'&&grouped?(
            grouped.map(([dateStr,appts])=>(
              <DateGroup key={dateStr} dateStr={dateStr}>
                {appts.map(a=>(
                  <ApptCard key={a.id} appt={a} formatTime={formatTime}
                    onClick={()=>navigate('/barber/calendar',{state:{selectedId:a.id}})}/>
                ))}
              </DateGroup>
            ))
          ):(
            filtered.map(a=>(
              <ApptCard key={a.id} appt={a} formatTime={formatTime}
                onClick={()=>navigate('/barber/calendar',{state:{selectedId:a.id}})}/>
            ))
          )}
        </div>
      </div>
    </BarberLayout>
  )
}