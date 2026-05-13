import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import toast from 'react-hot-toast'
import BarberLayout from '../../components/layout/BarberLayout'
import { Plus, Edit2, EyeOff, Eye, Trash2, Scissors, X, Check, ChevronRight, Camera } from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1F1F1F'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const F      = { fontFamily:"'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
  * { box-sizing: border-box; }
  input,textarea { font-size: 16px !important; }
  ::-webkit-scrollbar { display: none; }
`

const EMPTY = { name:'', description:'', price:'', duration:'', serviceType:'single', isActive:true }
const TYPES = [
  { id:'combo',  label:'Combo',   icon:'✨' },
  { id:'single', label:'Service', icon:'✂️' },
  { id:'extra',  label:'Add-on',  icon:'➕' },
]

// ── Toggle switch ─────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{
        width:48, height:26, borderRadius:13, padding:3,
        background: value ? ORANGE : CARD2,
        border:`1px solid ${value ? ORANGE : BORDER}`,
        cursor:'pointer', display:'flex',
        alignItems:'center', justifyContent: value ? 'flex-end' : 'flex-start',
        transition:'all 0.2s', flexShrink:0,
        boxShadow: value ? `0 0 10px ${ORANGE}44` : 'none',
      }}>
      <div style={{ width:20, height:20, borderRadius:'50%', background: value ? '#fff' : TXT3, transition:'all 0.2s' }}/>
    </button>
  )
}

// ── Service row ───────────────────────────────────────────────────────────
function ServiceRow({ svc, onEdit, onToggle, onDelete }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14,
      padding:'14px 16px',
      background: CARD2,
      border:`1px solid ${BORDER}`,
      borderRadius:16, marginBottom:8,
      opacity: svc.isActive ? 1 : 0.45,
      transition:'opacity 0.2s',
    }}>
      {/* Icon */}
      <div style={{ width:44, height:44, borderRadius:14, background: svc.serviceType==='combo'?`${ORANGE}18`:BG, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <Scissors size={18} color={svc.serviceType==='combo'?ORANGE:TXT3} strokeWidth={1.8}/>
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
          <p style={{ color:TXT, fontWeight:700, fontSize:15, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{svc.name}</p>
          {svc.serviceType==='combo' && (
            <span style={{ background:`${ORANGE}22`, color:ORANGE, fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:20, letterSpacing:'0.04em', flexShrink:0 }}>COMBO</span>
          )}
          {!svc.isActive && (
            <span style={{ background:CARD, color:TXT3, fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:20, border:`1px solid ${BORDER}`, flexShrink:0 }}>HIDDEN</span>
          )}
        </div>
        <p style={{ color:TXT2, fontSize:12, margin:0 }}>
          {formatDuration(svc.duration)}{svc.description ? ` · ${svc.description}` : ''}
        </p>
      </div>

      {/* Price */}
      <p style={{ color:ORANGE, fontWeight:800, fontSize:16, flexShrink:0, margin:0 }}>{formatCurrency(svc.price)}</p>

      {/* Toggle */}
      <Toggle value={!!svc.isActive} onChange={() => onToggle(svc)}/>

      {/* Edit */}
      <button onClick={() => onEdit(svc)}
        style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:10, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:TXT2, flexShrink:0 }}>
        <ChevronRight size={15}/>
      </button>
    </div>
  )
}

// ── Add/Edit sheet ────────────────────────────────────────────────────────
function ServiceSheet({ form, setForm, onSave, onClose, onDelete, editTarget, saving }) {
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  return (
    <div style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ width:'100%', maxWidth:520, background:CARD, borderRadius:'24px 24px 0 0', border:`1px solid ${BORDER}`, padding:'0 0 40px', maxHeight:'90vh', overflowY:'auto', animation:'slideUp 0.25s ease' }} onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ width:40, height:4, borderRadius:2, background:BORDER, margin:'12px auto 0' }}/>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:`1px solid ${BORDER}` }}>
          <p style={{ color:TXT, fontWeight:800, fontSize:18, margin:0 }}>{editTarget ? 'Edit Service' : 'Add Service'}</p>
          <div style={{ display:'flex', gap:8 }}>
            {editTarget && (
              <button onClick={() => onDelete(editTarget)}
                style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:'7px 12px', color:'#EF4444', fontSize:13, fontWeight:700, cursor:'pointer', ...F }}>
                Remove
              </button>
            )}
            <button onClick={onSave} disabled={saving}
              style={{ background:ORANGE, border:'none', borderRadius:10, padding:'7px 16px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', ...F, boxShadow:`0 4px 14px ${ORANGE}44`, display:'flex', alignItems:'center', gap:6 }}>
              {saving && <div style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div style={{ padding:'20px' }}>
          {/* Photo placeholder */}
          <div style={{ width:80, height:80, borderRadius:20, background:CARD2, border:`2px dashed ${BORDER}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', cursor:'pointer', gap:6 }}>
            <Camera size={20} color={TXT3}/>
            <span style={{ color:TXT3, fontSize:10, fontWeight:700 }}>Add Photo</span>
          </div>

          {/* Type selector */}
          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:12 }}>SERVICE TYPE</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {TYPES.map(t => (
                <button key={t.id} onClick={() => setForm(p => ({...p, serviceType:t.id}))}
                  style={{
                    padding:'12px 8px', borderRadius:14, border:`1.5px solid ${form.serviceType===t.id?ORANGE:BORDER}`,
                    background: form.serviceType===t.id ? `${ORANGE}18` : BG,
                    color: form.serviceType===t.id ? ORANGE : TXT2,
                    fontWeight:700, fontSize:12, cursor:'pointer', ...F,
                    transition:'all 0.15s',
                  }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{t.icon}</div>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>SERVICE NAME</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Skin Fade"
              style={{ width:'100%', background:'transparent', border:'none', borderBottom:`1.5px solid ${BORDER}`, color:TXT, padding:'10px 0', fontSize:16, outline:'none', ...F }}
              onFocus={e => e.target.style.borderBottomColor=ORANGE}
              onBlur={e  => e.target.style.borderBottomColor=BORDER}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>DESCRIPTION</label>
            <input value={form.description} onChange={set('description')} placeholder="A clean fade on the sides and back."
              style={{ width:'100%', background:'transparent', border:'none', borderBottom:`1.5px solid ${BORDER}`, color:TXT, padding:'10px 0', fontSize:16, outline:'none', ...F }}
              onFocus={e => e.target.style.borderBottomColor=ORANGE}
              onBlur={e  => e.target.style.borderBottomColor=BORDER}
            />
          </div>

          {/* Duration */}
          <div style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:14, padding:'14px 16px', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <p style={{ color:TXT, fontWeight:600, fontSize:15, margin:0 }}>Duration</p>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="number" value={form.duration} onChange={set('duration')} min="5"
                  style={{ width:60, background:'transparent', border:'none', borderBottom:`1.5px solid ${BORDER}`, color:ORANGE, fontSize:16, fontWeight:700, outline:'none', textAlign:'right', ...F }}
                  onFocus={e => e.target.style.borderBottomColor=ORANGE}
                  onBlur={e  => e.target.style.borderBottomColor=BORDER}
                />
                <span style={{ color:TXT2, fontSize:13 }}>min</span>
              </div>
            </div>
          </div>

          {/* Price */}
          <div style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:14, padding:'14px 16px', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <p style={{ color:TXT, fontWeight:600, fontSize:15, margin:0 }}>Price</p>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:TXT2, fontSize:16 }}>$</span>
                <input type="number" value={form.price} onChange={set('price')} min="0"
                  style={{ width:70, background:'transparent', border:'none', borderBottom:`1.5px solid ${BORDER}`, color:ORANGE, fontSize:18, fontWeight:800, outline:'none', textAlign:'right', ...F }}
                  onFocus={e => e.target.style.borderBottomColor=ORANGE}
                  onBlur={e  => e.target.style.borderBottomColor=BORDER}
                />
              </div>
            </div>
          </div>

          {/* Buffer Time */}
          <div style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:14, padding:'14px 16px', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <p style={{ color:TXT, fontWeight:600, fontSize:15, margin:'0 0 2px' }}>Buffer Time</p>
                <p style={{ color:TXT3, fontSize:12, margin:0 }}>Extra time after this service</p>
              </div>
              <span style={{ color:TXT2, fontSize:14, fontWeight:600 }}>15 min</span>
            </div>
          </div>

          {/* Active toggle */}
          <div style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:14, padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <p style={{ color:TXT, fontWeight:600, fontSize:15, margin:'0 0 2px' }}>Active</p>
                <p style={{ color:TXT3, fontSize:12, margin:0 }}>Visible to clients on booking page</p>
              </div>
              <Toggle value={!!form.isActive} onChange={v => setForm(p => ({...p, isActive:v}))}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BarberServices() {
  const { user } = useAuth()
  const [barber, setBarber]         = useState(null)
  const [services, setServices]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [sheetOpen, setSheetOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm]             = useState(EMPTY)
  const [saving, setSaving]         = useState(false)
  const [filter, setFilter]         = useState('all')

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const bSnap = await getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
        if (bSnap.empty) { setLoading(false); return }
        const b = { id:bSnap.docs[0].id, ...bSnap.docs[0].data() }
        setBarber(b)
        const sSnap = await getDocs(query(collection(db,'services'), where('barberId','==',b.id)))
        setServices(sSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name)))
      } catch { toast.error('Could not load services') }
      finally { setLoading(false) }
    }
    load()
  }, [user])

  function openAdd()    { setEditTarget(null); setForm(EMPTY); setSheetOpen(true) }
  function openEdit(s)  { setEditTarget(s); setForm({ name:s.name, description:s.description||'', price:s.price, duration:s.duration, serviceType:s.serviceType, isActive:s.isActive }); setSheetOpen(true) }

  async function handleSave() {
    if (!form.name.trim())                              return toast.error('Name required')
    if (!form.price || isNaN(form.price) || +form.price < 0) return toast.error('Enter valid price')
    if (!form.duration || isNaN(form.duration) || +form.duration < 1) return toast.error('Enter valid duration')
    setSaving(true)
    try {
      const payload = { barberId:barber.id, name:form.name.trim(), description:form.description.trim(), price:+form.price, duration:+form.duration, serviceType:form.serviceType, isActive:form.isActive }
      if (editTarget) {
        await updateDoc(doc(db,'services',editTarget.id), payload)
        setServices(p => p.map(s => s.id===editTarget.id ? {...s,...payload} : s))
        toast.success('Updated')
      } else {
        const ref = await addDoc(collection(db,'services'), {...payload, createdAt:serverTimestamp()})
        setServices(p => [...p,{id:ref.id,...payload}].sort((a,b)=>a.name.localeCompare(b.name)))
        toast.success('Added')
      }
      setSheetOpen(false)
    } catch { toast.error('Could not save') }
    finally { setSaving(false) }
  }

  async function toggleActive(svc) {
    await updateDoc(doc(db,'services',svc.id), { isActive:!svc.isActive })
    setServices(p => p.map(s => s.id===svc.id ? {...s,isActive:!s.isActive} : s))
    toast.success(svc.isActive ? 'Hidden' : 'Now visible')
  }

  async function handleDelete(svc) {
    await updateDoc(doc(db,'services',svc.id), { isActive:false })
    setServices(p => p.map(s => s.id===svc.id ? {...s,isActive:false} : s))
    toast.success('Removed')
    setSheetOpen(false)
  }

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  const tabs = [
    { id:'all',    label:'My Services' },
    { id:'combo',  label:'Combos'      },
    { id:'single', label:'Services'    },
    { id:'extra',  label:'Add-ons'     },
  ]

  const displayed = filter==='all' ? services : services.filter(s => s.serviceType===filter)
  const groups = ['combo','single','extra']
  const groupLabels = { combo:'COMBOS', single:'SERVICES', extra:'ADD-ONS' }

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background:BG, minHeight:'100vh', paddingBottom:100, ...F }}>
        <div style={{ padding:'16px 18px', maxWidth:600, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <h1 style={{ color:TXT, fontWeight:800, fontSize:22, margin:'0 0 2px', letterSpacing:'-0.3px' }}>Services</h1>
              <p style={{ color:TXT2, fontSize:13, margin:0 }}>{services.filter(s=>s.isActive).length} active · {services.length} total</p>
            </div>
            <button onClick={openAdd}
              style={{ background:ORANGE, border:'none', borderRadius:22, padding:'10px 18px', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:6, ...F, boxShadow:`0 4px 16px ${ORANGE}44` }}>
              <Plus size={16}/> Add New
            </button>
          </div>

          {/* Tab toggle */}
          <div style={{ display:'flex', background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:3, marginBottom:20 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setFilter(t.id)}
                style={{ flex:1, padding:'10px 6px', borderRadius:11, border:'none', cursor:'pointer', fontWeight:700, fontSize:12, background:filter===t.id?ORANGE:'transparent', color:filter===t.id?'#fff':TXT2, ...F, transition:'all 0.15s', whiteSpace:'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Empty state */}
          {displayed.length===0 ? (
            <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:20, padding:'40px 20px', textAlign:'center' }}>
              <div style={{ width:56, height:56, borderRadius:18, background:`${ORANGE}18`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <Scissors size={24} color={ORANGE} strokeWidth={1.8}/>
              </div>
              <p style={{ color:TXT, fontWeight:700, fontSize:16, margin:'0 0 6px' }}>No services yet</p>
              <p style={{ color:TXT2, fontSize:13, margin:'0 0 20px' }}>Add your first service to start booking</p>
              <button onClick={openAdd}
                style={{ background:ORANGE, border:'none', borderRadius:22, padding:'12px 24px', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', ...F, boxShadow:`0 4px 16px ${ORANGE}44` }}>
                <Plus size={16} style={{ verticalAlign:'middle', marginRight:6 }}/> Add Service
              </button>
            </div>
          ) : (
            /* Group by type */
            groups.map(type => {
              const group = displayed.filter(s => s.serviceType===type)
              if (!group.length) return null
              return (
                <div key={type} style={{ marginBottom:24 }}>
                  <p style={{ color:TXT3, fontSize:10, fontWeight:700, letterSpacing:'0.1em', marginBottom:10 }}>{groupLabels[type]}</p>
                  {group.map(svc => (
                    <ServiceRow key={svc.id} svc={svc} onEdit={openEdit} onToggle={toggleActive} onDelete={handleDelete}/>
                  ))}
                </div>
              )
            })
          )}

          {/* Add new bottom CTA */}
          {displayed.length > 0 && (
            <button onClick={openAdd}
              style={{ width:'100%', background:'transparent', border:`1.5px dashed ${BORDER}`, borderRadius:16, padding:'16px', color:TXT2, fontWeight:600, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, ...F, marginTop:8 }}>
              <Plus size={16}/> Add New Service
            </button>
          )}
        </div>
      </div>

      {/* Sheet */}
      {sheetOpen && (
        <ServiceSheet
          form={form} setForm={setForm}
          onSave={handleSave} onClose={() => setSheetOpen(false)}
          onDelete={handleDelete} editTarget={editTarget} saving={saving}
        />
      )}
    </BarberLayout>
  )
}