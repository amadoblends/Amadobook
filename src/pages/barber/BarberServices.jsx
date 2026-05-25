import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import BarberLayout from '../../components/layout/BarberLayout'
import { Plus, Pencil, Scissors, Sparkles, Layers, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

const BG='#0D0D0D',CARD='#141414',CARD2='#1C1C1E',BORDER='#252525'
const ORANGE='#FF6B1A',TXT='#F0F0F0',TXT2='#666',TXT3='#3A3A3A'
const GREEN='#22C55E',PURPLE='#7C3AED'
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

const TABS=[
  {key:'single',label:'Singles',icon:Scissors,color:ORANGE,desc:'Hide singles to force clients into your combo deals'},
  {key:'extra', label:'Extras', icon:Sparkles,color:GREEN, desc:'Add-ons stacked on top of any service'},
  {key:'combo', label:'Combos', icon:Layers,  color:PURPLE,desc:'Bundled deals — hidden singles still appear here'},
]

function ToggleSwitch({value,onChange,disabled}){
  return(
    <button
      onClick={e=>{e.stopPropagation();if(!disabled)onChange(!value)}}
      disabled={disabled}
      style={{
        width:46,height:26,borderRadius:13,padding:3,
        background:value?ORANGE:CARD2,
        border:`1px solid ${value?ORANGE:BORDER}`,
        cursor:disabled?'not-allowed':'pointer',
        display:'flex',alignItems:'center',
        justifyContent:value?'flex-end':'flex-start',
        transition:'all 0.2s',flexShrink:0,
        boxShadow:value?`0 0 10px ${ORANGE}44`:'none',
        opacity:disabled?0.5:1,
      }}>
      <div style={{width:20,height:20,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.4)',transition:'all 0.2s'}}/>
    </button>
  )
}

export default function BarberServices(){
  const{services,loading}=useBarberData()
  const navigate=useNavigate()
  const[tab,setTab]=useState('single')

  // ── Local copy of services — completely independent from Firestore listener ──
  // This prevents onSnapshot from fighting with optimistic updates
  const[localServices,setLocalServices]=useState([])
  const pendingIds=useRef(new Set()) // track which IDs are mid-update
  const initialized=useRef(false)

  // Only sync from Firestore when NOT in the middle of a toggle
  useEffect(()=>{
    if(!initialized.current){
      setLocalServices(services)
      initialized.current=true
      return
    }
    // Merge: keep local value for pending IDs, use Firestore value for the rest
    setLocalServices(prev=>{
      if(!prev.length)return services
      return services.map(fs=>{
        if(pendingIds.current.has(fs.id)){
          // Still pending — keep our local version
          const local=prev.find(p=>p.id===fs.id)
          return local||fs
        }
        return fs
      })
    })
  },[services])

  const filtered=useMemo(()=>
    localServices
      .filter(s=>(s.serviceType||'single')===tab)
      .sort((a,b)=>{
        const aV=a.visibleToClients!==false&&a.isActive!==false
        const bV=b.visibleToClients!==false&&b.isActive!==false
        if(aV!==bV)return aV?-1:1
        return(a.name||'').localeCompare(b.name||'')
      })
  ,[localServices,tab])

  const counts=useMemo(()=>({
    single:localServices.filter(s=>(s.serviceType||'single')==='single').length,
    extra: localServices.filter(s=>s.serviceType==='extra').length,
    combo: localServices.filter(s=>s.serviceType==='combo').length,
  }),[localServices])

  function updateLocal(id,patch){
    setLocalServices(prev=>prev.map(s=>s.id===id?{...s,...patch}:s))
  }

  async function toggleVisible(svc){
    const nv=svc.visibleToClients===false
    // 1. Update local immediately
    updateLocal(svc.id,{visibleToClients:nv,isActive:true})
    // 2. Mark as pending so Firestore listener doesn't overwrite
    pendingIds.current.add(svc.id)
    try{
      await updateDoc(doc(db,'services',svc.id),{visibleToClients:nv,isActive:true})
    }catch{
      // Revert
      updateLocal(svc.id,{visibleToClients:svc.visibleToClients,isActive:svc.isActive})
      toast.error('Could not update')
    }finally{
      // Remove from pending after Firestore confirms
      setTimeout(()=>pendingIds.current.delete(svc.id),2000)
    }
  }

  async function toggleComboActive(svc){
    const nv=svc.isActive===false
    updateLocal(svc.id,{isActive:nv})
    pendingIds.current.add(svc.id)
    try{
      await updateDoc(doc(db,'services',svc.id),{isActive:nv})
    }catch{
      updateLocal(svc.id,{isActive:svc.isActive})
      toast.error('Could not update')
    }finally{
      setTimeout(()=>pendingIds.current.delete(svc.id),2000)
    }
  }

  if(loading)return(
    <BarberLayout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:20,height:20,border:'2px solid #252525',borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  const activeTab=TABS.find(t=>t.key===tab)

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100%',paddingBottom:40,...F}}>
        <div style={{padding:'12px 14px',maxWidth:540,margin:'0 auto'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div>
              <h1 style={{color:TXT,fontWeight:800,fontSize:18,margin:'0 0 1px',letterSpacing:'-0.3px'}}>Services</h1>
              <p style={{color:TXT2,fontSize:11,margin:0}}>{counts.single} singles · {counts.extra} extras · {counts.combo} combos</p>
            </div>
            <button onClick={()=>navigate('/barber/services/add',{state:{serviceType:tab}})}
              style={{background:ORANGE,border:'none',borderRadius:9,padding:'7px 14px',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontWeight:700,fontSize:12,...F,boxShadow:`0 3px 10px ${ORANGE}38`}}>
              <Plus size={13}/> Add
            </button>
          </div>

          {/* Tabs */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:14}}>
            {TABS.map(t=>{
              const Icon=t.icon,active=tab===t.key
              return(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  style={{padding:'10px 6px',borderRadius:12,border:`1.5px solid ${active?t.color:BORDER}`,background:active?`${t.color}12`:'transparent',cursor:'pointer',...F,display:'flex',flexDirection:'column',alignItems:'center',gap:5,transition:'all 0.15s'}}>
                  <Icon size={15} color={active?t.color:TXT3} strokeWidth={active?2.2:1.8}/>
                  <span style={{color:active?t.color:TXT2,fontWeight:active?700:500,fontSize:11}}>{t.label}</span>
                  <span style={{color:active?t.color:TXT3,fontWeight:800,fontSize:13}}>{counts[t.key]}</span>
                </button>
              )
            })}
          </div>

          {/* Description */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:'8px 12px',marginBottom:10}}>
            <p style={{color:TXT2,fontSize:11,margin:0}}>{activeTab?.desc}</p>
          </div>

          {/* Hidden hint */}
          {(tab==='single'||tab==='extra')&&filtered.some(s=>s.visibleToClients===false)&&(
            <div style={{background:`${ORANGE}08`,border:`1px solid ${ORANGE}18`,borderRadius:10,padding:'8px 12px',marginBottom:10,display:'flex',alignItems:'center',gap:7}}>
              <EyeOff size={12} color={ORANGE}/>
              <p style={{color:ORANGE,fontSize:11,margin:0,fontWeight:600}}>Hidden singles still appear in combos — clients can only get them through deals</p>
            </div>
          )}

          {/* List */}
          {filtered.length===0?(
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'28px 16px',textAlign:'center'}}>
              <p style={{color:TXT2,fontSize:13,fontWeight:600,margin:'0 0 8px'}}>No {activeTab?.label.toLowerCase()} yet</p>
              <button onClick={()=>navigate('/barber/services/add',{state:{serviceType:tab}})}
                style={{background:ORANGE,border:'none',borderRadius:20,padding:'9px 20px',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',...F}}>
                + Add First {activeTab?.label.slice(0,-1)}
              </button>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:1,background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden'}}>
              {filtered.map((svc,i)=>{
                const tabColor=TABS.find(t=>t.key===tab)?.color||ORANGE
                const isVisible=tab==='combo'
                  ?svc.isActive!==false
                  :svc.visibleToClients!==false
                const isPending=pendingIds.current.has(svc.id)

                return(
                  <div key={svc.id} className="fu"
                    style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderBottom:i<filtered.length-1?`1px solid ${BORDER}`:'none',opacity:isVisible?1:0.5,transition:'opacity 0.15s'}}>

                    <div style={{width:38,height:38,borderRadius:10,background:isVisible?`${tabColor}12`:CARD2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden',position:'relative'}}>
                      {svc.photoURL
                        ?<img src={svc.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                        :<span style={{fontSize:16}}>{tab==='combo'?'📦':tab==='extra'?'✨':'✂️'}</span>}
                      {!isVisible&&(
                        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:10}}>
                          <EyeOff size={12} color='#fff'/>
                        </div>
                      )}
                    </div>

                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                        <p style={{color:isVisible?TXT:TXT2,fontWeight:700,fontSize:13,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svc.name}</p>
                        {!isVisible&&tab!=='combo'&&(
                          <span style={{background:CARD2,color:TXT3,fontSize:8,fontWeight:800,padding:'1px 6px',borderRadius:20,flexShrink:0,border:`1px solid ${BORDER}`}}>HIDDEN</span>
                        )}
                        {svc.serviceType==='combo'&&svc.discount?.value>0&&(
                          <span style={{background:`${GREEN}14`,color:GREEN,fontSize:8,fontWeight:800,padding:'1px 6px',borderRadius:20,flexShrink:0}}>
                            {svc.discount.type==='pct'?`${svc.discount.value}% OFF`:`$${svc.discount.value} OFF`}
                          </span>
                        )}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{color:isVisible?tabColor:TXT3,fontWeight:800,fontSize:13}}>{formatCurrency(svc.price)}</span>
                        <span style={{color:TXT3,fontSize:11}}>{formatDuration(svc.duration)}</span>
                      </div>
                    </div>

                    <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                      <button onClick={()=>navigate('/barber/services/edit',{state:{service:svc}})}
                        style={{width:28,height:28,borderRadius:7,background:CARD2,border:`1px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:TXT2}}>
                        <Pencil size={11}/>
                      </button>
                      <ToggleSwitch
                        value={isVisible}
                        disabled={isPending}
                        onChange={()=>tab==='combo'?toggleComboActive(svc):toggleVisible(svc)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </BarberLayout>
  )
}