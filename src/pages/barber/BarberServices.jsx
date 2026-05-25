/**
 * BarberServices
 * - Singles: toggle visibleToClients (hidden = not bookable alone, but usable in combos)
 * - Extras: toggle visibleToClients
 * - Combos: always show, toggle isActive
 * - Toggle is stable: uses ref-based override, never reverts
 */
import { useState, useMemo, useRef } from 'react'
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
  {key:'single',label:'Singles',icon:Scissors,color:ORANGE,desc:'Hide a single to make it only available through combos'},
  {key:'extra', label:'Extras', icon:Sparkles,color:GREEN, desc:'Add-ons that stack on top of any service'},
  {key:'combo', label:'Combos', icon:Layers,  color:PURPLE,desc:'Bundle deals — built from all your singles regardless of visibility'},
]

function Toggle({on,onToggle,saving}){
  return(
    <button
      onClick={e=>{e.stopPropagation();if(!saving)onToggle()}}
      style={{
        width:46,height:26,borderRadius:13,padding:3,flexShrink:0,
        background:on?ORANGE:CARD2,
        border:`1px solid ${on?ORANGE:BORDER}`,
        cursor:saving?'not-allowed':'pointer',
        opacity:saving?0.6:1,
        display:'flex',alignItems:'center',
        justifyContent:on?'flex-end':'flex-start',
        transition:'background 0.2s, border-color 0.2s',
        boxShadow:on?`0 0 10px ${ORANGE}44`:'none',
      }}>
      <div style={{width:20,height:20,borderRadius:'50%',background:'#fff',
        boxShadow:'0 1px 4px rgba(0,0,0,0.4)'}}/>
    </button>
  )
}

// ─── Key insight: we store overrides in a REF (not state) so Firestore's
// onSnapshot never triggers a re-render that wipes our optimistic value.
// We only force a re-render manually after updating the ref.
export default function BarberServices(){
  const{services,loading}=useBarberData()
  const navigate=useNavigate()
  const[tab,setTab]=useState('single')
  const[,forceRender]=useState(0) // used to trigger re-render after ref update
  const overridesRef=useRef({}) // {[svcId]: {visibleToClients?:bool, isActive?:bool}}
  const savingRef=useRef({})   // {[svcId]: true} while write is in-flight

  // Merge Firestore data with our overrides ref
  const allServices=useMemo(()=>
    services.map(s=>{
      const ov=overridesRef.current[s.id]
      return ov?{...s,...ov}:s
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ,[services, /* ref contents change triggers via forceRender */])

  const filtered=useMemo(()=>
    allServices.filter(s=>(s.serviceType||'single')===tab)
  ,[allServices,tab])

  const counts=useMemo(()=>({
    single:allServices.filter(s=>(s.serviceType||'single')==='single').length,
    extra: allServices.filter(s=>s.serviceType==='extra').length,
    combo: allServices.filter(s=>s.serviceType==='combo').length,
  }),[allServices])

  // isVisible: what the toggle reflects
  function getVisible(svc){
    if(tab==='combo') return svc.isActive!==false
    // singles/extras: visibleToClients — undefined/null/true = visible, false = hidden
    return svc.visibleToClients!==false
  }

  async function handleToggle(svc){
    const id=svc.id
    if(savingRef.current[id])return // debounce

    const currentlyVisible=getVisible(svc)
    const newVisible=!currentlyVisible

    // 1. Write to ref immediately — this is what allServices will read
    if(tab==='combo'){
      overridesRef.current[id]={isActive:newVisible}
    } else {
      overridesRef.current[id]={visibleToClients:newVisible}
    }
    savingRef.current[id]=true
    forceRender(n=>n+1) // trigger re-render with new ref values

    // 2. Write to Firestore
    try{
      const payload=tab==='combo'
        ?{isActive:newVisible}
        :{visibleToClients:newVisible, isActive:true}
      await updateDoc(doc(db,'services',id),payload)
      // 3. Success — keep override until Firestore listener catches up (1.5s)
      setTimeout(()=>{
        delete overridesRef.current[id]
        delete savingRef.current[id]
        forceRender(n=>n+1)
      },1500)
    }catch{
      // Revert
      delete overridesRef.current[id]
      delete savingRef.current[id]
      forceRender(n=>n+1)
      toast.error('Could not save')
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
              <p style={{color:ORANGE,fontSize:11,margin:0,fontWeight:600}}>
                Hidden singles still appear in your combos — clients must book them as a deal
              </p>
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
                const isVisible=getVisible(svc)
                const isSaving=!!savingRef.current[svc.id]

                return(
                  <div key={svc.id} className="fu"
                    style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px',
                      borderBottom:i<filtered.length-1?`1px solid ${BORDER}`:'none',
                      opacity:isVisible?1:0.45,transition:'opacity 0.2s'}}>

                    {/* Icon */}
                    <div style={{width:38,height:38,borderRadius:10,
                      background:isVisible?`${tabColor}12`:CARD2,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      flexShrink:0,overflow:'hidden',position:'relative'}}>
                      {svc.photoURL
                        ?<img src={svc.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                        :<span style={{fontSize:16}}>{tab==='combo'?'📦':tab==='extra'?'✨':'✂️'}</span>}
                      {!isVisible&&(
                        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.55)',
                          display:'flex',alignItems:'center',justifyContent:'center',borderRadius:10}}>
                          <EyeOff size={12} color='#fff'/>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                        <p style={{color:isVisible?TXT:TXT2,fontWeight:700,fontSize:13,margin:0,
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svc.name}</p>
                        {!isVisible&&tab!=='combo'&&(
                          <span style={{background:CARD2,color:TXT3,fontSize:8,fontWeight:800,
                            padding:'1px 6px',borderRadius:20,flexShrink:0,border:`1px solid ${BORDER}`}}>HIDDEN</span>
                        )}
                        {tab==='combo'&&svc.discount?.value>0&&(
                          <span style={{background:`${GREEN}14`,color:GREEN,fontSize:8,fontWeight:800,
                            padding:'1px 6px',borderRadius:20,flexShrink:0}}>
                            {svc.discount.type==='pct'?`${svc.discount.value}% OFF`:`$${svc.discount.value} OFF`}
                          </span>
                        )}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{color:isVisible?tabColor:TXT3,fontWeight:800,fontSize:13}}>
                          {formatCurrency(svc.price)}
                        </span>
                        <span style={{color:TXT3,fontSize:11}}>{formatDuration(svc.duration)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                      <button onClick={()=>navigate('/barber/services/edit',{state:{service:svc}})}
                        style={{width:28,height:28,borderRadius:7,background:CARD2,
                          border:`1px solid ${BORDER}`,display:'flex',alignItems:'center',
                          justifyContent:'center',cursor:'pointer',color:TXT2}}>
                        <Pencil size={11}/>
                      </button>
                      <Toggle
                        on={isVisible}
                        saving={isSaving}
                        onToggle={()=>handleToggle(svc)}
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