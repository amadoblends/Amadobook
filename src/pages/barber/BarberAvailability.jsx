import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { getDayName } from '../../utils/helpers'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import BarberLayout from '../../components/layout/BarberLayout'
import { Plus, X, ChevronDown, ChevronUp, Settings2, Save } from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

const BG='#0D0D0D',CARD='#171717',CARD2='#1F1F1F',BORDER='#2A2A2A'
const ORANGE='#FF6B1A',TXT='#F5F5F5',TXT2='#888888',TXT3='#555555'
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
  *{box-sizing:border-box}
  input{font-size:16px!important}
  input[type="time"]{color-scheme:dark}
  input[type="date"]{color-scheme:dark}
  ::-webkit-scrollbar{display:none}
`

const DAYS=[0,1,2,3,4,5,6]
const DEFAULT_DAY={enabled:true,startTime:'09:00',endTime:'18:00',breaks:[]}
const DAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// blockedDates helpers — backward compat with old string[] format
function normBlocked(bd){return(bd||[]).map(d=>typeof d==='string'?{date:d,reason:''}:d)}
function isBlocked(bd,dateStr){return normBlocked(bd).some(d=>d.date===dateStr)}

function Toggle({value,onChange}){
  return<button onClick={()=>onChange(!value)} style={{width:50,height:28,borderRadius:14,padding:3,background:value?ORANGE:CARD2,border:`1px solid ${value?ORANGE:BORDER}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:value?'flex-end':'flex-start',transition:'all 0.22s',flexShrink:0,boxShadow:value?`0 0 12px ${ORANGE}44`:'none'}}>
    <div style={{width:22,height:22,borderRadius:'50%',background:'#fff',transition:'all 0.22s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
  </button>
}

function SettingsModal({open,onClose,slotDuration,setSlotDuration,bufferTime,setBufferTime,advanceDays,setAdvanceDays,minNotice,setMinNotice,onSave,saving}){
  if(!open)return null
  return(
    <div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:440,background:CARD,borderRadius:20,border:`1px solid ${BORDER}`,padding:0,maxHeight:'85vh',overflowY:'auto',animation:'fadeIn 0.2s ease'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:`1px solid ${BORDER}`}}>
          <p style={{color:TXT,fontWeight:800,fontSize:18,margin:0}}>Booking Rules</p>
          <button onClick={onClose} style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'6px 7px',color:TXT2,cursor:'pointer',display:'flex'}}><X size={16}/></button>
        </div>
        <div style={{padding:'20px'}}>
          {[
            {label:'Time slot interval',desc:'How often slots appear',value:slotDuration,set:setSlotDuration,presets:[15,30,60],suffix:'min'},
            {label:'Buffer between appointments',desc:'Extra time after each cut',value:bufferTime,set:setBufferTime,presets:[0,10,15],suffix:'min',zeroLabel:'None'},
            {label:'Booking window',desc:'How far ahead clients can book',value:advanceDays,set:setAdvanceDays,presets:[14,30,60],suffix:'days'},
            {label:'Minimum notice',desc:'Least time before a booking',value:minNotice,set:setMinNotice,presets:[0,60,240],suffix:'min',zeroLabel:'None'},
          ].map(s=>(
            <div key={s.label} style={{marginBottom:24}}>
              <p style={{color:TXT,fontWeight:700,fontSize:15,margin:'0 0 3px'}}>{s.label}</p>
              <p style={{color:TXT2,fontSize:12,margin:'0 0 12px'}}>{s.desc}</p>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                {s.presets.map(v=>(
                  <button key={v} onClick={()=>s.set(v)} style={{flex:1,padding:'11px 4px',borderRadius:14,border:`1.5px solid ${s.value===v?ORANGE:BORDER}`,background:s.value===v?ORANGE:'transparent',color:s.value===v?'#fff':TXT2,fontWeight:700,fontSize:12,cursor:'pointer',...F,transition:'all 0.15s',boxShadow:s.value===v?`0 4px 12px ${ORANGE}33`:'none'}}>
                    {v===0&&s.zeroLabel?s.zeroLabel:`${v} ${s.suffix}`}
                  </button>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10,background:BG,border:`1px solid ${BORDER}`,borderRadius:12,padding:'10px 14px'}}>
                <input type="number" value={String(s.value)}
                  onFocus={e=>e.target.select()}
                  onChange={e=>{const v=e.target.value.replace(/^0+(?=\d)/,'');s.set(Math.max(0,parseInt(v)||0))}}
                  min="0" style={{flex:1,background:'transparent',border:'none',outline:'none',color:TXT,fontSize:16,fontWeight:700,...F}}/>
                <span style={{color:TXT2,fontSize:13}}>{s.suffix}</span>
              </div>
            </div>
          ))}
          <button onClick={onSave} disabled={saving} style={{width:'100%',background:ORANGE,border:'none',borderRadius:22,padding:'16px',color:'#fff',fontWeight:700,fontSize:16,cursor:'pointer',...F,boxShadow:`0 4px 24px ${ORANGE}44`,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            {saving&&<div style={{width:18,height:18,border:'2.5px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>}
            {saving?'Saving…':'Save Rules'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BarberAvailability(){
  const{user}=useAuth()
  useEffect(()=>{window.scrollTo(0,0)},[])

  const[barber,setBarber]=useState(null)
  const[availId,setAvailId]=useState(null)
  const[schedule,setSchedule]=useState(()=>Object.fromEntries(DAYS.map(d=>[d,d===0?{...DEFAULT_DAY,enabled:false}:{...DEFAULT_DAY}])))
  const[blockedDates,setBlockedDates]=useState([]) // {date, reason}[]
  const[slotDuration,setSlotDuration]=useState(15)
  const[bufferTime,setBufferTime]=useState(0)
  const[advanceDays,setAdvanceDays]=useState(30)
  const[minNotice,setMinNotice]=useState(60)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[settingsOpen,setSettingsOpen]=useState(false)
  const[expanded,setExpanded]=useState(null)
  const[showBlockInput,setShowBlockInput]=useState(false)
  const[newBlockDate,setNewBlockDate]=useState(format(new Date(),'yyyy-MM-dd'))
  const[newBlockReason,setNewBlockReason]=useState('')
  const[activeTab,setActiveTab]=useState('weekly')

  useEffect(()=>{
    if(!user)return
    async function load(){
      try{
        const bSnap=await getDocs(query(collection(db,'barbers'),where('userId','==',user.uid)))
        if(bSnap.empty){setLoading(false);return}
        const b={id:bSnap.docs[0].id,...bSnap.docs[0].data()}
        setBarber(b)
        const aSnap=await getDocs(query(collection(db,'availability'),where('barberId','==',b.id)))
        if(!aSnap.empty){
          const data=aSnap.docs[0].data()
          setAvailId(aSnap.docs[0].id)
          setBlockedDates(normBlocked(data.blockedDates))
          setSlotDuration(data.slotDuration||15)
          setBufferTime(data.bufferTime||0)
          setAdvanceDays(data.advanceDays||30)
          setMinNotice(data.minNotice||60)
          if(data.schedule)setSchedule(data.schedule)
          else{const s={};DAYS.forEach(d=>{s[d]={enabled:(data.workingDays||[1,2,3,4,5,6]).includes(d),startTime:data.startTime||'09:00',endTime:data.endTime||'18:00',breaks:data.breaks||[]}});setSchedule(s)}
        }
      }catch{toast.error('Could not load')}
      finally{setLoading(false)}
    }
    load()
  },[user])

  function updateDay(d,field,val){setSchedule(p=>({...p,[d]:{...p[d],[field]:val}}))}
  function addBreak(d){setSchedule(p=>({...p,[d]:{...p[d],breaks:[...(p[d].breaks||[]),{startTime:'12:00',endTime:'13:00'}]}}))}
  function removeBreak(d,i){setSchedule(p=>({...p,[d]:{...p[d],breaks:p[d].breaks.filter((_,idx)=>idx!==i)}}))}
  function updateBreak(d,i,f,v){setSchedule(p=>({...p,[d]:{...p[d],breaks:p[d].breaks.map((b,idx)=>idx===i?{...b,[f]:v}:b)}}))}

  async function saveBlocked(dates){
    if(!barber)return
    try{
      const payload={blockedDates:dates,updatedAt:serverTimestamp()}
      if(availId)await updateDoc(doc(db,'availability',availId),payload)
    }catch{toast.error('Could not save')}
  }

  function addBlockedDate(){
    if(!newBlockDate)return
    if(blockedDates.some(d=>d.date===newBlockDate)){toast.error('Already blocked');return}
    const entry={date:newBlockDate,reason:newBlockReason.trim()}
    const updated=[...blockedDates,entry].sort((a,b)=>a.date.localeCompare(b.date))
    setBlockedDates(updated)
    setNewBlockReason('')
    setShowBlockInput(false)
    saveBlocked(updated)
  }

  function removeBlockedDate(date){
    const updated=blockedDates.filter(d=>d.date!==date)
    setBlockedDates(updated)
    saveBlocked(updated)
  }

  async function handleSave(){
    if(!barber)return
    setSaving(true)
    try{
      const payload={barberId:barber.id,schedule,blockedDates,slotDuration,bufferTime,advanceDays,minNotice,workingDays:DAYS.filter(d=>schedule[d]?.enabled),startTime:schedule[1]?.startTime||'09:00',endTime:schedule[1]?.endTime||'18:00',breaks:schedule[1]?.breaks||[],updatedAt:serverTimestamp()}
      if(availId)await updateDoc(doc(db,'availability',availId),payload)
      else{const ref=doc(collection(db,'availability'));await setDoc(ref,payload);setAvailId(ref.id)}
      toast.success('Schedule saved!')
      setSettingsOpen(false)
    }catch{toast.error('Could not save')}
    finally{setSaving(false)}
  }

  if(loading)return<BarberLayout><PageLoader/></BarberLayout>

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100vh',paddingBottom:100,...F}}>
        <div style={{padding:'16px 18px',maxWidth:600,margin:'0 auto'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div>
              <h1 style={{color:TXT,fontWeight:800,fontSize:22,margin:'0 0 2px',letterSpacing:'-0.3px'}}>Availability</h1>
              <p style={{color:TXT2,fontSize:13,margin:0}}>Set your working hours per day</p>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setSettingsOpen(true)} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'9px 12px',color:TXT2,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:600,...F}}>
                <Settings2 size={15}/> Rules
              </button>
              {activeTab==='weekly'&&<button onClick={handleSave} disabled={saving} style={{background:ORANGE,border:'none',borderRadius:12,padding:'9px 16px',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:700,...F,boxShadow:`0 4px 14px ${ORANGE}44`}}>
                {saving?<div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>:<Save size={14}/>}
                {saving?'Saving…':'Save'}
              </button>}
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:3,marginBottom:20}}>
            {['Weekly','Exceptions'].map(t=>(
              <button key={t} onClick={()=>setActiveTab(t.toLowerCase())}
                style={{flex:1,padding:'10px',borderRadius:11,border:'none',fontWeight:700,fontSize:13,background:activeTab===t.toLowerCase()?ORANGE:'transparent',color:activeTab===t.toLowerCase()?'#fff':TXT2,cursor:'pointer',...F,transition:'all 0.15s'}}>
                {t}{t==='Exceptions'&&blockedDates.length>0?` (${blockedDates.length})`:''}
              </button>
            ))}
          </div>

          {/* ── WEEKLY TAB ── */}
          {activeTab==='weekly'&&(
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
              {DAYS.map(d=>{
                const day=schedule[d]||DEFAULT_DAY
                const isExp=expanded===d
                return(
                  <div key={d} style={{background:CARD,border:`1px solid ${day.enabled?`${ORANGE}33`:BORDER}`,borderRadius:16,overflow:'hidden',transition:'border-color 0.2s'}}>
                    <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px'}}>
                      <Toggle value={!!day.enabled} onChange={v=>updateDay(d,'enabled',v)}/>
                      <p style={{color:day.enabled?TXT:TXT2,fontWeight:700,fontSize:15,flex:1,margin:0}}>{DAY_NAMES[d]}</p>
                      {day.enabled?(
                        <>
                          <span style={{color:TXT2,fontSize:13,fontWeight:500}}>{day.startTime} – {day.endTime}</span>
                          <button onClick={()=>setExpanded(isExp?null:d)} style={{background:'none',border:'none',color:TXT3,cursor:'pointer',padding:4,display:'flex'}}>
                            {isExp?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
                          </button>
                        </>
                      ):(
                        <span style={{color:TXT3,fontSize:13}}>Closed</span>
                      )}
                    </div>
                    {day.enabled&&isExp&&(
                      <div style={{padding:'0 16px 16px',borderTop:`1px solid ${BORDER}`}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,margin:'14px 0'}}>
                          {[['Opens','startTime'],['Closes','endTime']].map(([lbl,field])=>(
                            <div key={field}>
                              <label style={{display:'block',color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',marginBottom:8}}>{lbl.toUpperCase()}</label>
                              <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:12,padding:'10px 14px'}}>
                                <input type="time" value={day[field]} onChange={e=>updateDay(d,field,e.target.value)}
                                  style={{background:'transparent',border:'none',outline:'none',color:TXT,fontSize:15,fontWeight:700,width:'100%',...F}}/>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                          <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',margin:0}}>BREAKS</p>
                          <button onClick={()=>addBreak(d)} style={{background:'none',border:'none',color:ORANGE,fontSize:13,fontWeight:700,cursor:'pointer',...F,display:'flex',alignItems:'center',gap:4}}>
                            <Plus size={13}/> Add
                          </button>
                        </div>
                        {(day.breaks||[]).length===0&&<p style={{color:TXT3,fontSize:12}}>No breaks scheduled</p>}
                        {(day.breaks||[]).map((b,i)=>(
                          <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                            <div style={{flex:1,background:BG,border:`1px solid ${BORDER}`,borderRadius:12,padding:'10px 12px'}}>
                              <input type="time" value={b.startTime} onChange={e=>updateBreak(d,i,'startTime',e.target.value)}
                                style={{background:'transparent',border:'none',outline:'none',color:TXT,fontSize:14,fontWeight:700,width:'100%',...F}}/>
                            </div>
                            <span style={{color:TXT3}}>–</span>
                            <div style={{flex:1,background:BG,border:`1px solid ${BORDER}`,borderRadius:12,padding:'10px 12px'}}>
                              <input type="time" value={b.endTime} onChange={e=>updateBreak(d,i,'endTime',e.target.value)}
                                style={{background:'transparent',border:'none',outline:'none',color:TXT,fontSize:14,fontWeight:700,width:'100%',...F}}/>
                            </div>
                            <button onClick={()=>removeBreak(d,i)} style={{width:36,height:36,borderRadius:10,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,color:'#EF4444'}}>
                              <X size={14}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── EXCEPTIONS TAB ── */}
          {activeTab==='exceptions'&&(
            <div style={{marginBottom:20}}>
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'18px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                  <div>
                    <p style={{color:TXT,fontWeight:700,fontSize:15,margin:'0 0 2px'}}>Blocked / Closed Days</p>
                    <p style={{color:TXT2,fontSize:11,margin:0}}>Dates when you're unavailable for bookings</p>
                  </div>
                  <button onClick={()=>setShowBlockInput(v=>!v)} style={{background:`${ORANGE}18`,border:`1px solid ${ORANGE}33`,borderRadius:10,padding:'7px 12px',color:ORANGE,fontSize:13,fontWeight:700,cursor:'pointer',...F,display:'flex',alignItems:'center',gap:5}}>
                    <Plus size={13}/> Block Day
                  </button>
                </div>

                {showBlockInput&&(
                  <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:14,padding:'14px',marginBottom:14,animation:'fadeIn 0.15s ease'}}>
                    <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.08em',margin:'0 0 10px'}}>BLOCK DATE</p>
                    <input type="date" value={newBlockDate} min={format(new Date(),'yyyy-MM-dd')} onChange={e=>setNewBlockDate(e.target.value)}
                      style={{width:'100%',background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'10px 12px',color:TXT,fontSize:15,fontWeight:600,outline:'none',marginBottom:10,...F}}/>
                    <input type="text" value={newBlockReason} onChange={e=>setNewBlockReason(e.target.value)}
                      placeholder='Reason: "Holiday", "Vacation", "Private Event"…'
                      style={{width:'100%',background:CARD2,border:`1px solid ${BORDER}`,borderRadius:10,padding:'10px 12px',color:TXT,fontSize:14,outline:'none',marginBottom:12,...F}}
                      onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor=BORDER}/>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>{setShowBlockInput(false);setNewBlockReason('')}} style={{flex:1,padding:'11px',borderRadius:14,background:'transparent',border:`1px solid ${BORDER}`,color:TXT2,fontWeight:600,cursor:'pointer',...F}}>Cancel</button>
                      <button onClick={addBlockedDate} style={{flex:1,padding:'11px',borderRadius:14,background:ORANGE,border:'none',color:'#fff',fontWeight:700,cursor:'pointer',...F}}>Block Day</button>
                    </div>
                  </div>
                )}

                {blockedDates.length===0?(
                  <div style={{textAlign:'center',padding:'20px 0'}}>
                    <p style={{color:TXT3,fontSize:13}}>No blocked dates — you're open every day</p>
                  </div>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {blockedDates.map(({date,reason})=>(
                      <div key={date} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.15)',borderRadius:14}}>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{color:'#EF4444',fontSize:13,fontWeight:700,margin:'0 0 1px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{format(new Date(date+'T12:00'),'EEE, MMM d, yyyy')}</p>
                          {reason&&<p style={{color:'#EF444488',fontSize:11,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{reason}</p>}
                          {!reason&&<p style={{color:TXT3,fontSize:11,margin:0,fontStyle:'italic'}}>No reason specified</p>}
                        </div>
                        <button onClick={()=>removeBlockedDate(date)} style={{background:'none',border:'none',color:'rgba(239,68,68,0.6)',cursor:'pointer',display:'flex',padding:4}}>
                          <X size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{background:`${ORANGE}0A`,border:`1px solid ${ORANGE}18`,borderRadius:14,padding:'12px 14px',marginTop:12}}>
                <p style={{color:TXT2,fontSize:12,margin:0}}>
                  💡 Blocked dates are saved immediately. Clients will not be able to book on these days and will see your message.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <SettingsModal
        open={settingsOpen} onClose={()=>setSettingsOpen(false)}
        slotDuration={slotDuration} setSlotDuration={setSlotDuration}
        bufferTime={bufferTime} setBufferTime={setBufferTime}
        advanceDays={advanceDays} setAdvanceDays={setAdvanceDays}
        minNotice={minNotice} setMinNotice={setMinNotice}
        onSave={handleSave} saving={saving}
      />
    </BarberLayout>
  )
}
