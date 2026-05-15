import { useState } from 'react'
import { doc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import toast from 'react-hot-toast'
import BarberLayout from '../../components/layout/BarberLayout'
import { Plus, Scissors, X, Check, ChevronRight, Camera } from 'lucide-react'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeIn 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
input,textarea{font-size:16px!important}
::-webkit-scrollbar{display:none}
`

const EMPTY={name:'',description:'',price:'',duration:'',serviceType:'single',isActive:true}
const TYPES=[{id:'single',label:'Service',icon:'✂️'},{id:'combo',label:'Combo',icon:'✨'},{id:'extra',label:'Add-on',icon:'➕'}]

function Toggle({value,onChange}){
  return(
    <button onClick={()=>onChange(!value)}
      style={{width:44,height:24,borderRadius:12,padding:2,background:value?ORANGE:CARD2,border:`1px solid ${value?ORANGE:BORDER}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:value?'flex-end':'flex-start',transition:'all 0.2s',flexShrink:0,boxShadow:value?`0 0 8px ${ORANGE}40`:'none'}}>
      <div style={{width:20,height:20,borderRadius:'50%',background:value?'#fff':TXT3,transition:'all 0.2s'}}/>
    </button>
  )
}

function ServiceRow({svc,onEdit,onToggle}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 12px',background:CARD2,border:`1px solid ${BORDER}`,borderRadius:12,marginBottom:6,opacity:svc.isActive?1:0.4,transition:'opacity 0.2s'}}>
      <div style={{width:36,height:36,borderRadius:10,background:svc.serviceType==='combo'?`${ORANGE}14`:BG,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <Scissors size={15} color={svc.serviceType==='combo'?ORANGE:TXT3} strokeWidth={1.8}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:1}}>
          <p style={{color:TXT,fontWeight:700,fontSize:13,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svc.name}</p>
          {svc.serviceType==='combo'&&<span style={{background:`${ORANGE}18`,color:ORANGE,fontSize:8,fontWeight:800,padding:'1px 5px',borderRadius:8,flexShrink:0}}>COMBO</span>}
          {!svc.isActive&&<span style={{background:CARD,color:TXT3,fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:8,border:`1px solid ${BORDER}`,flexShrink:0}}>HIDDEN</span>}
        </div>
        <p style={{color:TXT2,fontSize:11,margin:0}}>{formatDuration(svc.duration)}{svc.description?` · ${svc.description}`:''}</p>
      </div>
      <p style={{color:ORANGE,fontWeight:800,fontSize:13,flexShrink:0,margin:0}}>{formatCurrency(svc.price)}</p>
      <Toggle value={!!svc.isActive} onChange={()=>onToggle(svc)}/>
      <button onClick={()=>onEdit(svc)} style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:TXT2,flexShrink:0}}>
        <ChevronRight size={13}/>
      </button>
    </div>
  )
}

// Centered modal
function Modal({children,onClose}){
  return(
    <div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'fadeIn 0.15s ease'}} onClick={onClose}>
      <div style={{width:'100%',maxWidth:420,background:CARD,borderRadius:20,border:`1px solid ${BORDER}`,maxHeight:'88dvh',overflowY:'auto',animation:'slideUp 0.2s ease',...F}} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function ServiceSheet({form,setForm,onSave,onClose,onDelete,editTarget,saving}){
  const set=f=>e=>setForm(p=>({...p,[f]:e.target.value}))
  const fieldStyle={width:'100%',background:BG,border:`1px solid ${BORDER}`,borderRadius:10,padding:'10px 12px',color:TXT,fontSize:15,outline:'none',...F,transition:'border-color 0.15s'}

  return(
    <Modal onClose={onClose}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:`1px solid ${BORDER}`}}>
        <p style={{color:TXT,fontWeight:700,fontSize:15,margin:0}}>{editTarget?'Edit Service':'New Service'}</p>
        <div style={{display:'flex',gap:6}}>
          {editTarget&&(
            <button onClick={()=>onDelete(editTarget)}
              style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.18)',borderRadius:8,padding:'6px 10px',color:'#EF4444',fontSize:12,fontWeight:700,cursor:'pointer',...F}}>
              Remove
            </button>
          )}
          <button onClick={onSave} disabled={saving}
            style={{background:ORANGE,border:'none',borderRadius:8,padding:'6px 14px',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',...F,display:'flex',alignItems:'center',gap:5,boxShadow:`0 3px 10px ${ORANGE}35`}}>
            {saving&&<div style={{width:12,height:12,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>}
            {saving?'Saving…':'Save'}
          </button>
        </div>
      </div>

      <div style={{padding:'14px 16px 24px'}}>
        {/* Type selector */}
        <div style={{marginBottom:16}}>
          <label style={{display:'block',color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:8}}>SERVICE TYPE</label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
            {TYPES.map(t=>(
              <button key={t.id} onClick={()=>setForm(p=>({...p,serviceType:t.id}))}
                style={{padding:'10px 6px',borderRadius:10,border:`1.5px solid ${form.serviceType===t.id?ORANGE:BORDER}`,background:form.serviceType===t.id?`${ORANGE}14`:BG,color:form.serviceType===t.id?ORANGE:TXT2,fontWeight:700,fontSize:11,cursor:'pointer',...F,transition:'all 0.12s'}}>
                <div style={{fontSize:16,marginBottom:3}}>{t.icon}</div>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div style={{marginBottom:12}}>
          <label style={{display:'block',color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:6}}>NAME *</label>
          <input value={form.name} onChange={set('name')} placeholder="e.g. Skin Fade" style={fieldStyle}
            onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor=BORDER}/>
        </div>

        {/* Description */}
        <div style={{marginBottom:12}}>
          <label style={{display:'block',color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:6}}>DESCRIPTION</label>
          <input value={form.description} onChange={set('description')} placeholder="Optional short description" style={fieldStyle}
            onFocus={e=>e.target.style.borderColor=ORANGE} onBlur={e=>e.target.style.borderColor=BORDER}/>
        </div>

        {/* Duration + Price */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <div>
            <label style={{display:'block',color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:6}}>DURATION (MIN) *</label>
            <div style={{...fieldStyle,display:'flex',alignItems:'center',gap:6,padding:'10px 12px'}}>
              <input type="number" value={form.duration} onChange={set('duration')} min="5" placeholder="30"
                style={{flex:1,background:'transparent',border:'none',outline:'none',color:ORANGE,fontSize:15,fontWeight:700,...F,textAlign:'right'}}/>
              <span style={{color:TXT2,fontSize:12}}>min</span>
            </div>
          </div>
          <div>
            <label style={{display:'block',color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:6}}>PRICE ($) *</label>
            <div style={{...fieldStyle,display:'flex',alignItems:'center',gap:4,padding:'10px 12px'}}>
              <span style={{color:TXT2,fontSize:14}}>$</span>
              <input type="number" value={form.price} onChange={set('price')} min="0" placeholder="25"
                style={{flex:1,background:'transparent',border:'none',outline:'none',color:ORANGE,fontSize:15,fontWeight:700,...F,textAlign:'right'}}/>
            </div>
          </div>
        </div>

        {/* Active toggle */}
        <div style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <p style={{color:TXT,fontWeight:600,fontSize:13,margin:'0 0 1px'}}>Active</p>
            <p style={{color:TXT3,fontSize:11,margin:0}}>Visible to clients on booking page</p>
          </div>
          <Toggle value={!!form.isActive} onChange={v=>setForm(p=>({...p,isActive:v}))}/>
        </div>
      </div>
    </Modal>
  )
}

export default function BarberServices(){
  // ✅ No Firebase queries on mount — reads from global cache
  const{barber,services,activeServices,loading,refreshServices}=useBarberData()

  const[sheetOpen, setSheetOpen]   = useState(false)
  const[editTarget,setEditTarget]  = useState(null)
  const[form,setForm]              = useState(EMPTY)
  const[saving,setSaving]          = useState(false)
  const[filter,setFilter]          = useState('all')

  function openAdd(){setEditTarget(null);setForm(EMPTY);setSheetOpen(true)}
  function openEdit(s){setEditTarget(s);setForm({name:s.name,description:s.description||'',price:s.price,duration:s.duration,serviceType:s.serviceType,isActive:s.isActive});setSheetOpen(true)}

  async function handleSave(){
    if(!form.name.trim())return toast.error('Name required')
    if(!form.price||isNaN(form.price)||+form.price<0)return toast.error('Valid price required')
    if(!form.duration||isNaN(form.duration)||+form.duration<1)return toast.error('Valid duration required')
    setSaving(true)
    try{
      const payload={barberId:barber.id,name:form.name.trim(),description:form.description.trim(),price:+form.price,duration:+form.duration,serviceType:form.serviceType,isActive:form.isActive}
      if(editTarget){
        await updateDoc(doc(db,'services',editTarget.id),payload)
        toast.success('Updated')
      }else{
        await addDoc(collection(db,'services'),{...payload,createdAt:serverTimestamp()})
        toast.success('Service added')
      }
      await refreshServices()
      setSheetOpen(false)
    }catch{toast.error('Could not save')}
    finally{setSaving(false)}
  }

  async function toggleActive(svc){
    await updateDoc(doc(db,'services',svc.id),{isActive:!svc.isActive})
    await refreshServices()
    toast.success(svc.isActive?'Hidden':'Now visible')
  }

  async function handleDelete(svc){
    await updateDoc(doc(db,'services',svc.id),{isActive:false})
    await refreshServices()
    toast.success('Removed')
    setSheetOpen(false)
  }

  if(loading)return(
    <BarberLayout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:22,height:22,border:`2px solid #333`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  const tabs=[{id:'all',label:'All'},{id:'combo',label:'Combos'},{id:'single',label:'Services'},{id:'extra',label:'Add-ons'}]
  const displayed=filter==='all'?services:services.filter(s=>s.serviceType===filter)
  const groups=['combo','single','extra']
  const groupLabels={combo:'COMBOS',single:'SERVICES',extra:'ADD-ONS'}

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100%',paddingBottom:16,...F}}>
        <div style={{padding:'12px 14px',maxWidth:540,margin:'0 auto'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div>
              <h1 style={{color:TXT,fontWeight:800,fontSize:18,margin:'0 0 1px',letterSpacing:'-0.3px'}}>Services</h1>
              <p style={{color:TXT2,fontSize:11,margin:0}}>{activeServices.length} active · {services.length} total</p>
            </div>
            <button onClick={openAdd}
              style={{background:ORANGE,border:'none',borderRadius:20,padding:'8px 14px',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:5,...F,boxShadow:`0 3px 10px ${ORANGE}35`}}>
              <Plus size={13}/> Add
            </button>
          </div>

          {/* Filter tabs */}
          <div style={{display:'flex',background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:2,marginBottom:14}}>
            {tabs.map(t=>(
              <button key={t.id} onClick={()=>setFilter(t.id)}
                style={{flex:1,padding:'8px 4px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:700,fontSize:11,background:filter===t.id?ORANGE:'transparent',color:filter===t.id?'#fff':TXT2,...F,transition:'all 0.12s',whiteSpace:'nowrap'}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Empty state */}
          {displayed.length===0?(
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'28px 16px',textAlign:'center'}}>
              <div style={{width:44,height:44,borderRadius:14,background:`${ORANGE}14`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                <Scissors size={20} color={ORANGE} strokeWidth={1.8}/>
              </div>
              <p style={{color:TXT,fontWeight:700,fontSize:14,margin:'0 0 4px'}}>No services yet</p>
              <p style={{color:TXT2,fontSize:12,margin:'0 0 14px'}}>Add your first service to start booking</p>
              <button onClick={openAdd}
                style={{background:ORANGE,border:'none',borderRadius:20,padding:'10px 20px',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',...F}}>
                + Add Service
              </button>
            </div>
          ):(
            groups.map(type=>{
              const group=displayed.filter(s=>s.serviceType===type)
              if(!group.length)return null
              return(
                <div key={type} style={{marginBottom:16}}>
                  <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.1em',marginBottom:7,paddingLeft:2}}>{groupLabels[type]}</p>
                  {group.map(svc=>(
                    <ServiceRow key={svc.id} svc={svc} onEdit={openEdit} onToggle={toggleActive}/>
                  ))}
                </div>
              )
            })
          )}

          {/* Add more */}
          {displayed.length>0&&(
            <button onClick={openAdd}
              style={{width:'100%',background:'transparent',border:`1.5px dashed ${BORDER}`,borderRadius:12,padding:'13px',color:TXT2,fontWeight:600,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,...F,marginTop:4}}>
              <Plus size={14}/> Add Service
            </button>
          )}
        </div>
      </div>

      {sheetOpen&&(
        <ServiceSheet form={form} setForm={setForm} onSave={handleSave} onClose={()=>setSheetOpen(false)} onDelete={handleDelete} editTarget={editTarget} saving={saving}/>
      )}
    </BarberLayout>
  )
}