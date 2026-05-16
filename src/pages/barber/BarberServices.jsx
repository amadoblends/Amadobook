/**
 * BarberServices — Optimistic UI
 * ✓ Toggle hidden/active updates instantly (no lag)
 * ✓ Firestore update in background
 * ✓ Reverts on error
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberData } from '../../hooks/useBarberData'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import BarberLayout from '../../components/layout/BarberLayout'
import { Plus, Eye, EyeOff, Pencil, Trash2, Search, X, Scissors } from 'lucide-react'
import toast from 'react-hot-toast'

const BG=('#0D0D0D'),CARD=('#141414'),CARD2=('#1C1C1E'),BORDER=('#252525'),ORANGE=('#FF6B1A'),TXT=('#F0F0F0'),TXT2=('#666666'),TXT3=('#3A3A3A'),RED=('#EF4444')
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp 0.2s ease both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{display:none}
`

const SVC_TYPES=['Haircut','Beard','Color','Treatment','Package','Other']

export default function BarberServices(){
  const{services,loading}=useBarberData()
  const navigate=useNavigate()
  const[search,setSearch]=useState('')
  const[filterType,setFilterType]=useState('all')
  const[showSearch,setShowSearch]=useState(false)

  // ── LOCAL OVERRIDE MAP for optimistic updates ────────────────────────────
  // { [svcId]: { isActive: bool } }
  const[localOverrides,setLocalOverrides]=useState({})

  // Merge services with local overrides (optimistic)
  const mergedServices=useMemo(()=>
    services.map(s=>localOverrides[s.id]!==undefined?{...s,...localOverrides[s.id]}:s)
  ,[services,localOverrides])

  const filtered=useMemo(()=>{
    let list=mergedServices
    if(filterType!=='all')list=list.filter(s=>s.serviceType===filterType)
    if(search.trim()){
      const q=search.toLowerCase()
      list=list.filter(s=>s.name?.toLowerCase().includes(q))
    }
    return list.sort((a,b)=>{
      if(a.isActive===b.isActive)return a.name?.localeCompare(b.name)||0
      return a.isActive?-1:1
    })
  },[mergedServices,filterType,search])

  const active=mergedServices.filter(s=>s.isActive).length
  const hidden=mergedServices.filter(s=>!s.isActive).length

  // ── Optimistic toggle ────────────────────────────────────────────────────
  async function toggleHidden(svc){
    const newVal=!svc.isActive
    // 1. Update local state immediately (no lag)
    setLocalOverrides(p=>({...p,[svc.id]:{isActive:newVal}}))
    // 2. Firestore update in background
    try{
      await updateDoc(doc(db,'services',svc.id),{isActive:newVal})
      // 3. Clear local override (real data will come from Firestore listener)
      setLocalOverrides(p=>{const n={...p};delete n[svc.id];return n})
    }catch{
      // 4. Revert on error
      setLocalOverrides(p=>({...p,[svc.id]:{isActive:svc.isActive}}))
      toast.error('Could not update')
    }
  }

  async function deleteService(svc){
    if(!confirm(`Delete "${svc.name}"? This cannot be undone.`))return
    // Optimistic remove
    setLocalOverrides(p=>({...p,[svc.id]:{_deleted:true}}))
    try{
      await deleteDoc(doc(db,'services',svc.id))
      toast.success(`"${svc.name}" deleted`)
    }catch{
      setLocalOverrides(p=>{const n={...p};delete n[svc.id];return n})
      toast.error('Could not delete')
    }
  }

  if(loading)return(
    <BarberLayout>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh'}}>
        <div style={{width:20,height:20,border:`2px solid #333`,borderTopColor:ORANGE,borderRadius:'50%',animation:'spin 0.65s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </BarberLayout>
  )

  return(
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100%',paddingBottom:24,...F}}>
        <div style={{padding:'12px 14px',maxWidth:540,margin:'0 auto'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div>
              <h1 style={{color:TXT,fontWeight:800,fontSize:18,margin:'0 0 1px',letterSpacing:'-0.3px'}}>Services</h1>
              <p style={{color:TXT2,fontSize:11,margin:0}}>{active} active · {hidden} hidden</p>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setShowSearch(p=>!p)}
                style={{background:CARD2,border:`1px solid ${BORDER}`,borderRadius:8,padding:'7px 8px',color:showSearch?ORANGE:TXT2,cursor:'pointer',display:'flex'}}>
                <Search size={14}/>
              </button>
              <button onClick={()=>navigate('/barber/services/add')}
                style={{background:ORANGE,border:'none',borderRadius:9,padding:'7px 13px',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontWeight:700,fontSize:12,...F,boxShadow:`0 3px 10px ${ORANGE}38`}}>
                <Plus size={13}/> Add
              </button>
            </div>
          </div>

          {/* Search */}
          {showSearch&&(
            <div style={{display:'flex',alignItems:'center',gap:8,background:CARD,border:`1px solid ${BORDER}`,borderRadius:10,padding:'8px 11px',marginBottom:10}}>
              <Search size={13} color={TXT3}/>
              <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search services…"
                style={{flex:1,background:'transparent',border:'none',outline:'none',color:TXT,fontSize:14,...F}}/>
              {search&&<button onClick={()=>setSearch('')} style={{background:'none',border:'none',color:TXT3,cursor:'pointer',padding:0,display:'flex'}}><X size={12}/></button>}
            </div>
          )}

          {/* Type filters */}
          <div style={{display:'flex',gap:5,marginBottom:12,overflowX:'auto',paddingBottom:2}}>
            {['all',...SVC_TYPES].map(t=>(
              <button key={t} onClick={()=>setFilterType(t)}
                style={{padding:'5px 11px',borderRadius:20,border:`1px solid ${filterType===t?ORANGE:BORDER}`,background:filterType===t?`${ORANGE}14`:'transparent',color:filterType===t?ORANGE:TXT2,fontWeight:filterType===t?700:500,fontSize:11,whiteSpace:'nowrap',cursor:'pointer',...F,flexShrink:0}}>
                {t==='all'?'All':t}
              </button>
            ))}
          </div>

          {/* Services list */}
          {filtered.length===0?(
            <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:14,padding:'28px 16px',textAlign:'center'}}>
              <Scissors size={20} style={{color:TXT3,display:'block',margin:'0 auto 8px'}} strokeWidth={1.5}/>
              <p style={{color:TXT2,fontSize:13,fontWeight:600,margin:'0 0 4px'}}>{search?'No services match':'No services yet'}</p>
              {!search&&<button onClick={()=>navigate('/barber/services/add')}
                style={{marginTop:10,background:ORANGE,border:'none',borderRadius:20,padding:'9px 20px',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',...F}}>
                + Add First Service
              </button>}
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {filtered
                .filter(s=>!localOverrides[s.id]?._deleted)
                .map((svc,i)=>{
                  const isHidden=!svc.isActive
                  return(
                    <div key={svc.id} className="fu"
                      style={{background:isHidden?`${CARD}80`:CARD2,border:`1px solid ${isHidden?BORDER:BORDER}`,borderRadius:12,padding:'11px 12px',display:'flex',alignItems:'center',gap:10,opacity:isHidden?0.55:1,transition:'opacity 0.15s'}}>
                      {/* Icon */}
                      <div style={{width:38,height:38,borderRadius:10,background:isHidden?BG:`${ORANGE}14`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <Scissors size={15} color={isHidden?TXT3:ORANGE} strokeWidth={1.8}/>
                      </div>
                      {/* Info */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                          <p style={{color:isHidden?TXT2:TXT,fontWeight:700,fontSize:13,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{svc.name}</p>
                          {isHidden&&<span style={{background:CARD2,color:TXT3,fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:8,flexShrink:0}}>HIDDEN</span>}
                          {svc.serviceType&&<span style={{background:`${ORANGE}10`,color:ORANGE,fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:8,flexShrink:0}}>{svc.serviceType}</span>}
                        </div>
                        <div style={{display:'flex',gap:8}}>
                          <span style={{color:ORANGE,fontWeight:800,fontSize:13}}>{formatCurrency(svc.price)}</span>
                          <span style={{color:TXT3,fontSize:11}}>{formatDuration(svc.duration)}</span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{display:'flex',gap:5,flexShrink:0}}>
                        {/* Toggle hidden — optimistic, no lag */}
                        <button onClick={()=>toggleHidden(svc)}
                          style={{width:32,height:32,borderRadius:8,background:isHidden?`${ORANGE}14`:CARD2,border:`1px solid ${isHidden?`${ORANGE}30`:BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:isHidden?ORANGE:TXT3}}>
                          {isHidden?<Eye size={13}/>:<EyeOff size={13}/>}
                        </button>
                        <button onClick={()=>navigate('/barber/services/edit',{state:{service:svc}})}
                          style={{width:32,height:32,borderRadius:8,background:CARD2,border:`1px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:TXT2}}>
                          <Pencil size={12}/>
                        </button>
                        <button onClick={()=>deleteService(svc)}
                          style={{width:32,height:32,borderRadius:8,background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.15)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:RED}}>
                          <Trash2 size={12}/>
                        </button>
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