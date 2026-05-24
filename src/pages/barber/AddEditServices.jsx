import { useEffect, useState, useRef, useMemo } from 'react'
import { collection, query, where, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { useBarberData } from '../../hooks/useBarberData'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Camera, Trash2, Check, ChevronDown, Scissors, Sparkles, Layers } from 'lucide-react'
import toast from 'react-hot-toast'

const BG=('#0D0D0D'),CARD=('#171717'),CARD2=('#1F1F1F'),BORDER=('#2A2A2A'),ORANGE=('#FF6B1A'),TXT=('#F5F5F5'),TXT2=('#888888'),TXT3=('#555555')
const GREEN='#22C55E', PURPLE='#7C3AED'
const F={fontFamily:"'DM Sans',system-ui,sans-serif"}
const CSS=`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}`

const DAYS_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const SERVICE_TYPES = [
  { key:'single', label:'Single',  icon:Scissors, color:ORANGE, desc:'Individual service' },
  { key:'extra',  label:'Extra',   icon:Sparkles,  color:GREEN,  desc:'Add-on service' },
  { key:'combo',  label:'Combo',   icon:Layers,    color:PURPLE, desc:'Bundle of singles' },
]
const CATEGORIES = ['Haircut','Beard','Color','Treatment','Combo','Other']
const DURATIONS  = [15,20,30,45,60,75,90,105,120]
const BUFFERS    = [0,5,10,15,20,30]

function FieldRow({ label, children, last }) {
  return (
    <div style={{padding:'14px 0',borderBottom:last?'none':`1px solid ${BORDER}`}}>
      <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',margin:'0 0 8px'}}>{label.toUpperCase()}</p>
      {children}
    </div>
  )
}

function Select({ value, onChange, options }) {
  return (
    <div style={{position:'relative'}}>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{width:'100%',background:'transparent',border:'none',outline:'none',color:TXT,fontSize:15,fontWeight:600,...F,appearance:'none',cursor:'pointer'}}>
        {options.map(o=>(
          <option key={typeof o==='object'?o.value:o} value={typeof o==='object'?o.value:o} style={{background:'#1a1a1a'}}>
            {typeof o==='object'?o.label:o}
          </option>
        ))}
      </select>
      <ChevronDown size={14} color={TXT3} style={{position:'absolute',right:0,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}/>
    </div>
  )
}

export default function AddEditService() {
  const { user } = useAuth()
  const { services } = useBarberData()
  const navigate = useNavigate()
  const location = useLocation()
  const editService = location.state?.service
  const preType = location.state?.serviceType || editService?.serviceType || 'single'
  const photoRef = useRef(null)

  const [barberId,   setBarberId]   = useState(null)
  const [barberDocId,setBarberDocId]= useState(null)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  const [form, setForm] = useState({
    name:        editService?.name        || '',
    description: editService?.description || '',
    duration:    editService?.duration    || 60,
    price:       editService?.price       || '',
    category:    editService?.category    || 'Haircut',
    bufferTime:  editService?.bufferTime  || 0,
    isActive:    editService?.isActive    !== false,
    photoURL:    editService?.photoURL    || '',
    serviceType: preType,
    includesIds: editService?.includesIds || [],
    discount:    editService?.discount    || { type:'pct', value:'' },
    activeDays:  editService?.activeDays  || [0,1,2,3,4,5,6],
  })

  // Services available for combo building — singles AND extras
  const comboPickerServices = useMemo(()=>
    services.filter(s=>(s.serviceType||'single')==='single'||s.serviceType==='extra')
  ,[services])

  // Auto-computed price/duration/description for combos
  const comboBaseTotal = useMemo(()=>{
    if(form.serviceType!=='combo') return 0
    return form.includesIds.reduce((sum,id)=>{
      const s=comboPickerServices.find(x=>x.id===id)
      return sum+(s?.price||0)
    },0)
  },[form.serviceType,form.includesIds,comboPickerServices])

  const comboFinalPrice = useMemo(()=>{
    const disc=parseFloat(form.discount?.value)||0
    if(!disc) return comboBaseTotal
    if(form.discount?.type==='pct') return Math.max(0,comboBaseTotal*(1-disc/100))
    return Math.max(0,comboBaseTotal-disc)
  },[comboBaseTotal,form.discount])

  const comboSavings = useMemo(()=>Math.max(0,comboBaseTotal-comboFinalPrice),[comboBaseTotal,comboFinalPrice])

  const comboDuration = useMemo(()=>{
    if(form.serviceType!=='combo') return 0
    return form.includesIds.reduce((sum,id)=>{
      const s=comboPickerServices.find(x=>x.id===id)
      return sum+(s?.duration||0)
    },0)
  },[form.serviceType,form.includesIds,comboPickerServices])

  const comboAutoDesc = useMemo(()=>{
    if(form.serviceType!=='combo'||!form.includesIds.length) return ''
    return form.includesIds.map(id=>comboPickerServices.find(x=>x.id===id)?.name).filter(Boolean).join(' + ')
  },[form.serviceType,form.includesIds,comboPickerServices])

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'barbers'),where('userId','==',user.uid))).then(snap => {
      if (!snap.empty) { setBarberId(snap.docs[0].id); setBarberDocId(snap.docs[0].id) }
      setLoading(false)
    })
  }, [user])

  async function uploadPhoto(file) {
    const id = barberDocId || 'tmp'
    const path = sRef(storage, `barbers/${id}/services/${Date.now()}`)
    const snap = await uploadBytes(path, file)
    return getDownloadURL(snap.ref)
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Service name required'); return }
    if (form.serviceType==='combo' && form.includesIds.length<2) { toast.error('Select at least 2 services'); return }
    if (form.serviceType!=='combo' && !form.price) { toast.error('Price required'); return }
    setSaving(true)
    try {
      const isCombo = form.serviceType==='combo'
      const payload = {
        name: form.name, description: form.description,
        duration: isCombo&&comboDuration>0 ? comboDuration : form.duration, category: form.category,
        bufferTime: form.bufferTime, isActive: form.isActive,
        photoURL: form.photoURL, serviceType: form.serviceType,
        price: isCombo ? comboFinalPrice : parseFloat(form.price)||0,
        ...(isCombo && {
          includesIds: form.includesIds,
          discount: { type: form.discount.type, value: parseFloat(form.discount.value)||0 },
          activeDays: form.activeDays,
          baseTotal: comboBaseTotal,
          savings: comboSavings,
        }),
        barberId: barberDocId,
        updatedAt: serverTimestamp(),
      }
      if (editService?.id) {
        await updateDoc(doc(db,'services',editService.id), payload)
        toast.success('Service updated')
      } else {
        payload.createdAt = serverTimestamp()
        await addDoc(collection(db,'services'), payload)
        toast.success('Service added')
      }
      navigate('/barber/services')
    } catch (e) { toast.error('Failed to save') }
    setSaving(false)
  }

  async function deleteService() {
    if (!editService?.id) return
    if (!window.confirm(`Delete "${editService.name}"?`)) return
    setDeleting(true)
    try { await deleteDoc(doc(db,'services',editService.id)); toast.success('Deleted'); navigate('/barber/services') }
    catch { toast.error('Failed') }
    setDeleting(false)
  }

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{background:BG,minHeight:'100vh',paddingBottom:100,...F}}>
        <div style={{padding:'16px 18px',maxWidth:640,margin:'0 auto'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',color:TXT2,cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:14,fontWeight:600,...F}}>
                <ChevronLeft size={18}/>
              </button>
              <h1 style={{color:TXT,fontWeight:800,fontSize:20,margin:0}}>{editService ? 'Edit Service' : 'Add Service'}</h1>
            </div>
            <button onClick={save} disabled={saving}
              style={{background:ORANGE,border:'none',borderRadius:10,padding:'9px 16px',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:14,...F,display:'flex',alignItems:'center',gap:6}}>
              {saving ? <div style={{width:14,height:14,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/> : <Check size={14}/>}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {/* Service Type */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:14}}>
            {SERVICE_TYPES.map(t=>{
              const Icon=t.icon; const active=form.serviceType===t.key
              return<button key={t.key} onClick={()=>setForm(p=>({...p,serviceType:t.key}))}
                style={{padding:'10px 6px',borderRadius:12,border:`1.5px solid ${active?t.color:BORDER}`,background:active?`${t.color}14`:'transparent',cursor:'pointer',...F,display:'flex',flexDirection:'column',alignItems:'center',gap:4,transition:'all 0.15s'}}>
                <Icon size={14} color={active?t.color:TXT3}/>
                <span style={{color:active?t.color:TXT2,fontWeight:active?700:500,fontSize:11}}>{t.label}</span>
                <span style={{color:active?t.color:TXT3,fontSize:9,fontWeight:500}}>{t.desc}</span>
              </button>
            })}
          </div>

          {/* Photo */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'20px 18px',marginBottom:14}}>
            <div style={{textAlign:'center',marginBottom:16}}>
              <div style={{position:'relative',display:'inline-block',cursor:'pointer'}} onClick={()=>photoRef.current?.click()}>
                <div style={{width:80,height:80,borderRadius:16,overflow:'hidden',background:CARD2,border:`1.5px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>
                  {form.photoURL ? <img src={form.photoURL} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/> : '✂️'}
                </div>
                <div style={{position:'absolute',bottom:-4,right:-4,width:24,height:24,borderRadius:'50%',background:ORANGE,border:`2px solid ${CARD}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Camera size={11} color="#fff"/>
                </div>
              </div>
              <p style={{color:TXT3,fontSize:12,marginTop:10}}>Tap to add photo</p>
              <input ref={photoRef} type="file" accept="image/*" style={{display:'none'}}
                onChange={async e=>{
                  const file=e.target.files?.[0]; if(!file)return
                  const reader=new FileReader(); reader.onload=ev=>setForm(p=>({...p,photoURL:ev.target.result})); reader.readAsDataURL(file)
                  try{const url=await uploadPhoto(file);setForm(p=>({...p,photoURL:url}))}catch{}
                }}/>
            </div>
          </div>

          {/* Form fields */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:20,padding:'4px 18px',marginBottom:14}}>
            <FieldRow label="Service Name">
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                placeholder="e.g. Skin Fade"
                style={{width:'100%',background:'transparent',border:'none',outline:'none',color:TXT,fontSize:16,fontWeight:600,...F}}/>
            </FieldRow>
            <FieldRow label="Description">
              <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={3}
                placeholder="Describe the service…"
                style={{width:'100%',background:'transparent',border:'none',outline:'none',color:TXT,fontSize:14,resize:'none',...F}}/>
            </FieldRow>
            <FieldRow label="Duration (minutes)">
              <Select value={form.duration} onChange={v=>setForm(p=>({...p,duration:parseInt(v)}))}
                options={DURATIONS.map(d=>({value:d,label:`${d} min`}))}/>
            </FieldRow>
            {form.serviceType!=='combo'&&(
              <FieldRow label="Price ($)">
                <input type="number" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))}
                  placeholder="0.00" min="0" step="0.01"
                  style={{width:'100%',background:'transparent',border:'none',outline:'none',color:TXT,fontSize:16,fontWeight:600,...F}}/>
              </FieldRow>
            )}
            <FieldRow label="Category">
              <Select value={form.category} onChange={v=>setForm(p=>({...p,category:v}))} options={CATEGORIES}/>
            </FieldRow>
            <FieldRow label="Buffer Time (minutes)" last>
              <Select value={form.bufferTime} onChange={v=>setForm(p=>({...p,bufferTime:parseInt(v)}))}
                options={BUFFERS.map(b=>({value:b,label:b===0?'No buffer':`${b} min`}))}/>
            </FieldRow>
          </div>

          {/* Active toggle */}
          <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'14px 18px',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <p style={{color:TXT,fontWeight:700,fontSize:14,margin:'0 0 2px'}}>Active</p>
              <p style={{color:TXT3,fontSize:12,margin:0}}>Clients can book this service</p>
            </div>
            <button onClick={()=>setForm(p=>({...p,isActive:!p.isActive}))}
              style={{
                width:48,height:26,borderRadius:13,border:'none',cursor:'pointer',
                background:form.isActive?ORANGE:BORDER,
                position:'relative',transition:'background 0.2s',
              }}>
              <div style={{
                position:'absolute',top:3,left:form.isActive?24:3,
                width:20,height:20,borderRadius:'50%',background:'#fff',
                transition:'left 0.2s',
              }}/>
            </button>
          </div>

          {/* Combo Builder */}
          {form.serviceType==='combo'&&(
            <>
              {/* Service Picker */}
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'14px 18px',marginBottom:10}}>
                <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',margin:'0 0 10px'}}>INCLUDED SERVICES</p>
                {comboPickerServices.length===0?(
                  <p style={{color:TXT3,fontSize:12,margin:0}}>No services yet. Add singles or extras first.</p>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {['single','extra'].map(type=>{
                      const group=comboPickerServices.filter(s=>(s.serviceType||'single')===type)
                      if(!group.length)return null
                      return<div key={type} style={{marginBottom:6}}>
                        <p style={{color:TXT3,fontSize:9,fontWeight:700,letterSpacing:'0.1em',margin:'0 0 5px',textTransform:'uppercase'}}>{type==='single'?'✂️ Singles':'✨ Extras'}</p>
                        {group.map(s=>{
                          const sel=form.includesIds.includes(s.id)
                          return<button key={s.id}
                            onClick={()=>setForm(p=>({...p,includesIds:sel?p.includesIds.filter(i=>i!==s.id):[...p.includesIds,s.id]}))}
                            style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 11px',borderRadius:10,border:`1px solid ${sel?PURPLE:BORDER}`,background:sel?`${PURPLE}12`:'transparent',cursor:'pointer',...F,marginBottom:4,width:'100%',textAlign:'left'}}>
                            <span style={{color:sel?TXT:TXT2,fontWeight:sel?700:500,fontSize:13}}>{s.name}</span>
                            <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                              <span style={{color:TXT3,fontSize:10}}>{s.duration}m</span>
                              <span style={{color:TXT3,fontSize:11}}>${(s.price||0).toFixed(2)}</span>
                              <div style={{width:18,height:18,borderRadius:5,background:sel?PURPLE:CARD2,border:`1px solid ${sel?PURPLE:BORDER}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                {sel&&<Check size={10} color="#fff"/>}
                              </div>
                            </div>
                          </button>
                        })}
                      </div>
                    })}
                  </div>
                )}
                {/* Price + Duration Summary — BELOW selection */}
                {form.includesIds.length>0&&(
                  <div style={{background:BG,border:`1px solid ${BORDER}`,borderRadius:12,padding:'12px 14px',marginTop:10}}>
                    {comboAutoDesc&&<p style={{color:TXT3,fontSize:11,margin:'0 0 8px',fontStyle:'italic'}}>📦 {comboAutoDesc}</p>}
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{color:TXT3,fontSize:12}}>Duration</span>
                      <span style={{color:TXT2,fontSize:12,fontWeight:600}}>{comboDuration} min</span>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:comboSavings>0?4:6}}>
                      <span style={{color:TXT3,fontSize:12}}>Subtotal</span>
                      <span style={{color:TXT2,fontSize:12,textDecoration:comboSavings>0?'line-through':'none'}}>${comboBaseTotal.toFixed(2)}</span>
                    </div>
                    {comboSavings>0&&<>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                        <span style={{color:GREEN,fontSize:12}}>Discount</span>
                        <span style={{color:GREEN,fontSize:12,fontWeight:700}}>−${comboSavings.toFixed(2)}</span>
                      </div>
                      <div style={{height:1,background:BORDER,margin:'6px 0'}}/>
                    </>}
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{color:TXT,fontSize:13,fontWeight:700}}>Total</span>
                      <span style={{color:PURPLE,fontSize:15,fontWeight:800}}>${comboFinalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Discount */}
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'14px 18px',marginBottom:10}}>
                <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',margin:'0 0 10px'}}>DISCOUNT</p>
                <div style={{display:'flex',gap:8}}>
                  <div style={{display:'flex',background:CARD2,borderRadius:8,padding:2,border:`1px solid ${BORDER}`,flexShrink:0}}>
                    {['pct','fixed'].map(t=>(
                      <button key={t} onClick={()=>setForm(p=>({...p,discount:{...p.discount,type:t}}))}
                        style={{padding:'6px 10px',borderRadius:6,border:'none',cursor:'pointer',background:form.discount.type===t?PURPLE:'transparent',color:form.discount.type===t?'#fff':TXT2,fontWeight:700,fontSize:11,...F}}>
                        {t==='pct'?'%':'$'}
                      </button>
                    ))}
                  </div>
                  <input type="number" value={form.discount.value} min="0"
                    onChange={e=>setForm(p=>({...p,discount:{...p.discount,value:e.target.value}}))}
                    placeholder={form.discount.type==='pct'?'e.g. 15':'e.g. 5'}
                    style={{flex:1,background:'transparent',border:`1px solid ${BORDER}`,borderRadius:8,padding:'6px 12px',color:TXT,fontSize:14,fontWeight:600,...F,outline:'none'}}/>
                </div>
              </div>

              {/* Active Days */}
              <div style={{background:CARD,border:`1px solid ${BORDER}`,borderRadius:16,padding:'14px 18px',marginBottom:14}}>
                <p style={{color:TXT3,fontSize:10,fontWeight:700,letterSpacing:'0.1em',margin:'0 0 10px'}}>ACTIVE DAYS</p>
                <div style={{display:'flex',gap:5}}>
                  {DAYS_LABELS.map((d,i)=>{
                    const on=form.activeDays.includes(i)
                    return<button key={i}
                      onClick={()=>setForm(p=>({...p,activeDays:on?p.activeDays.filter(x=>x!==i):[...p.activeDays,i]}))}
                      style={{flex:1,padding:'7px 0',borderRadius:8,border:`1px solid ${on?PURPLE:BORDER}`,background:on?`${PURPLE}18`:'transparent',cursor:'pointer',color:on?PURPLE:TXT3,fontWeight:on?700:500,fontSize:10,...F}}>
                      {d}
                    </button>
                  })}
                </div>
              </div>
            </>
          )}

          {/* Delete (only when editing) */}
          {editService?.id && (
            <button onClick={deleteService} disabled={deleting}
              style={{
                width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                padding:'14px',borderRadius:16,
                background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',
                color:'#EF4444',fontWeight:700,fontSize:14,cursor:'pointer',...F,
              }}>
              <Trash2 size={15}/>
              {deleting ? 'Deleting…' : 'Delete Service'}
            </button>
          )}
        </div>
      </div>
    </BarberLayout>
  )
}
