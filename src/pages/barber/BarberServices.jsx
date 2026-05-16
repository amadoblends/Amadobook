/**
 * BarberServices — Exact template match
 * ✓ "My Services" + "Categorize" tabs (like template)
 * ✓ Toggle switch per service (orange = active)
 * ✓ Optimistic toggle (no lag)
 * ✓ Price + duration shown
 * ✓ + Add New Service bottom button
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import BarberLayout from '../../components/layout/BarberLayout'
import { Plus, Pencil, Trash2, Scissors } from 'lucide-react'
import toast from 'react-hot-toast'

const BG='#0D0D0D', CARD='#141414', CARD2='#1C1C1E', BORDER='#252525'
const ORANGE='#FF6B1A', TXT='#F0F0F0', TXT2='#666', TXT3='#3A3A3A'
const F = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

const SVC_CATEGORIES = ['All','Haircut','Beard','Color','Treatment','Package','Other']

// Exact template toggle switch
function ToggleSwitch({value, onChange}){
  return<button onClick={()=>onChange(!value)}
    style={{width:46,height:26,borderRadius:13,padding:3,background:value?ORANGE:CARD2,border:`1px solid ${value?ORANGE:BORDER}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:value?'flex-end':'flex-start',transition:'all 0.2s',flexShrink:0,boxShadow:value?`0 0 10px ${ORANGE}44`:'none'}}>
    <div style={{width:20,height:20,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.4)',transition:'all 0.2s'}}/>
  </button>
}

const SVC_ICONS = {
  Haircut:'✂️', Beard:'🪒', Color:'🎨', Treatment:'💆', Package:'📦', Other:'✨'
}

export default function BarberServices(){
  const{services,loading}=useBarberData()
  const navigate=useNavigate()
  const[tab,setTab]=useState('my')
  const[filterCat,setFilterCat]=useState('All')
  const[localOverrides,setLocalOverrides]=useState({})

  const merged=useMemo(()=>
    services.map(s=>localOverrides[s.id]!==undefined?{...s,...localOverrides[s.id]}:s)
  ,[services,localOverrides])

  const filtered=useMemo(()=>{
    let list=merged.filter(s=>!localOverrides[s.id]?._deleted)
    if(tab==='categorize'&&filterCat!=='All')list=list.filter(s=>s.serviceType===filterCat)
    return list.sort((a,b)=>{
      if(a.isActive===b.isActive)return(a.serviceType||'').localeCompare(b.serviceType||'')||a.name?.localeCompare(b.name)||0
      return a.isActive?-1:1
    })
  },[merged,tab,filterCat,localOverrides])

  const activeCount=merged.filter(s=>s.isActive!==false&&!localOverrides[s.id]?._deleted).length

  async function toggleActive(svc){
    const nv=!svc.isActive
    setLocalOverrides(p=>({...p,[svc.id]:{isActive:nv}}))
    try{
      await updateDoc(doc(db,'services',svc.id),{isActive:nv})
      setLocalOverrides(p=>{const n={...p};delete n[svc.id];return n})
    }catch{
      setLocalOverrides(p=>({...p,[svc.id]:{isActive:svc.isActive}}))
      toast.error('Could not update')
    }
  }

  async function deleteSvc(svc){
    if(!confirm(`Delete "${svc.name}"?`))return
    setLocalOverrides(p=>({...p,[svc.id]:{_deleted:true}}))
    try{await deleteDoc(doc(db,'services',svc.id));toast.success('Deleted')}
    catch{setLocalOverrides(p=>{const n={...p};delete n[svc.id];return n});toast.error('Failed')}
  }

  if(loading)return<BarberLayout>
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
      <div style={{width:20,height:20,border:'2px solid #252525',borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  </BarberLayout>

  return<BarberLayout>
    <style>{CSS}</style>
    <div style={{background:BG,minHeight:'100%',paddingBottom:80,...F}}>
      <div style={{padding:'12px 14px',maxWidth:540,margin:'0 auto'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div>
            <h1 style={{color:TXT,fontWeight:800,fontSize:18,margin:'0 0 1px',letterSpacing:'-0.3px'}}>Services</h1>
            <p style={{color:TXT2,fontSize:11,margin:0}}>{activeCount} active services</p>
          </div>
          <button onClick={()=>navigate('/barber/services/add')}
            style={{background:ORANGE,border:'none',borderRadius:9,padding:'7px 14px',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontWeight:700,fontSize:12,...F,boxShadow:`0 3px 10px ${ORANGE}38`}}>
            <Plus size={13}/> Add
          </button>
        </div>

        {/* Tabs — exactly like template: "My Services" | "Categorize" */}
        <div style={{display:'flex',background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:3,marginBottom:14}}>
          {[['my','My Services'],['categorize','Categorize']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)}
              style={{flex:1,padding:'8px',borderRadius:8,border:'none',fontWeight:700,fontSize:12,background:tab===k?ORANGE:'transparent',color:tab===k?'#fff':TXT2,cursor:'pointer',...F,transition:'all 0.12s'}}>
              {l}
            </button>
          ))}
        </div>

        {/* Category filter (only in Categorize tab) */}
        {tab==='categorize'&&<div style={{display:'flex',gap:5,marginBottom:12,overflowX:'auto',paddingBottom:2}}>
          {SVC_CATEGORIES.map(cat=>(
            <button key={cat} onClick={()=>setFilterCat(cat)}
              style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${filterCat===cat?ORANGE:BORDER}`,background:filterCat===cat?`${ORANGE}14`:'transparent',color:filterCat===cat?ORANGE:TXT2,fontWeight:filterCat===cat?700:500,fontSize:11,whiteSpace:'nowrap',cursor:'pointer',...F,flexShrink:0}}>
              {cat}
            </button>
          ))}
        </div>}

        {/* Services list */}
        {filtered.length===0?(
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'28px 16px',textAlign:'center'}}>
            <Scissors size={20} style={{color:TXT3,display:'block',margin:'0 auto 8px'}} strokeWidth={1.5}/>
            <p style={{color:TXT2,fontSize:13,fontWeight:600,margin:'0 0 8px'}}>No services yet</p>
            <button onClick={()=>navigate('/barber/services/add')}
              style={{background:ORANGE,border:'none',borderRadius:20,padding:'9px 20px',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',...F}}>
              + Add First Service
            </button>
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:1,background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,overflow:'hidden'}}>
            {filtered.map((svc,i)=>{
              const isActive=svc.isActive!==false
              const icon=SVC_ICONS[svc.serviceType]||'✂️'
              return<div key={svc.id} className="fu"
                style={{display:'flex',alignItems:'center',gap:12,padding:'13px 14px',borderBottom:i<filtered.length-1?`1px solid ${BORDER}`:'none',background:'transparent',transition:'background 0.1s'}}>
                {/* Icon */}
                <div style={{width:38,height:38,borderRadius:10,background:isActive?`${ORANGE}12`:CARD2,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16}}>
                  {icon}
                </div>
                {/* Info */}
                <div style={{flex:1,minWidth:0}}>
                  <p style={{color:isActive?TXT:TXT2,fontWeight:700,fontSize:13,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svc.name}</p>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{color:ORANGE,fontWeight:800,fontSize:13}}>{formatCurrency(svc.price)}</span>
                    <span style={{color:TXT3,fontSize:11}}>{formatDuration(svc.duration)}</span>
                    {svc.serviceType&&<span style={{color:TXT3,fontSize:10}}>· {svc.serviceType}</span>}
                  </div>
                </div>
                {/* Toggle + actions */}
                <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  <button onClick={()=>navigate('/barber/services/edit',{state:{service:svc}})}
                    style={{width:28,height:28,borderRadius:7,background:CARD2,border:`1px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:TXT2}}>
                    <Pencil size={11}/>
                  </button>
                  {/* Main toggle — like template */}
                  <ToggleSwitch value={isActive} onChange={()=>toggleActive(svc)}/>
                </div>
              </div>
            })}
          </div>
        )}
      </div>
    </div>

    {/* Bottom CTA */}
    <div style={{position:'fixed',bottom:'calc(52px + env(safe-area-inset-bottom))',left:0,right:0,padding:'10px 14px',background:'rgba(13,13,13,0.97)',borderTop:`1px solid ${BORDER}`}}>
      <button onClick={()=>navigate('/barber/services/add')}
        style={{width:'100%',maxWidth:540,display:'block',margin:'0 auto',background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:'13px',color:TXT,fontWeight:700,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,...F}}>
        <Plus size={16} color={ORANGE}/> Add New Service
      </button>
    </div>
  </BarberLayout>
}