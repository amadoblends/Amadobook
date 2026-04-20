import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, formatDuration } from '../../utils/helpers'
import toast from 'react-hot-toast'
import BarberLayout from '../../components/layout/BarberLayout'
import Modal from '../../components/ui/Modal'
import { Plus, Edit2, EyeOff, Eye, Trash2, Scissors } from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

const EMPTY = { name:'', description:'', price:'', duration:'', serviceType:'single', isActive:true }
const TYPES = [
  { id:'combo',  label:'🔥 Combo'  },
  { id:'single', label:'✂️ Service' },
  { id:'extra',  label:'➕ Add-on'  },
]

export default function BarberServices() {
  const { user } = useAuth()
  const [barber, setBarber]     = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filter, setFilter] = useState('all')
  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const bSnap = await getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
        if (bSnap.empty) { setLoading(false); return }
        const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
        setBarber(b)
        const sSnap = await getDocs(query(collection(db,'services'), where('barberId','==',b.id)))
        setServices(sSnap.docs.map(d => ({id:d.id,...d.data()})).sort((a,b) => a.name.localeCompare(b.name)))
      } catch { toast.error('Could not load services') }
      finally { setLoading(false) }
    }
    load()
  }, [user])

  function openAdd() { setEditTarget(null); setForm(EMPTY); setModalOpen(true) }
  function openEdit(svc) {
    setEditTarget(svc)
    setForm({ name:svc.name, description:svc.description||'', price:svc.price, duration:svc.duration, serviceType:svc.serviceType, isActive:svc.isActive })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name required')
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
      setModalOpen(false)
    } catch { toast.error('Could not save') }
    finally { setSaving(false) }
  }

  async function toggleActive(svc) {
    await updateDoc(doc(db,'services',svc.id), { isActive:!svc.isActive })
    setServices(p => p.map(s => s.id===svc.id ? {...s,isActive:!s.isActive} : s))
    toast.success(svc.isActive ? 'Hidden from clients' : 'Now visible')
  }

  async function handleDelete() {
    await updateDoc(doc(db,'services',deleteTarget.id), { isActive:false })
    setServices(p => p.map(s => s.id===deleteTarget.id ? {...s,isActive:false} : s))
    toast.success('Deactivated')
    setDeleteTarget(null)
  }

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  const displayed = filter === 'all' ? services : services.filter(s => s.serviceType === filter)
  const groups = ['combo','single','extra']
  const groupTitles = { combo:'🔥 Combos', single:'✂️ Services', extra:'➕ Add-ons' }

  return (
    <BarberLayout>
      <div className="p-4 max-w-xl mx-auto w-full overflow-x-hidden">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold" style={{fontFamily:"'Space Grotesk','Monda',sans-serif",color:'var(--text-pri)'}}>Services</h1>
            <p className="text-xs" style={{color:'var(--text-sec)'}}>{services.filter(s=>s.isActive).length} active · {services.length} total</p>
          </div>
          <button onClick={openAdd} className="btn-primary gap-1.5 px-4" style={{minHeight:40,fontSize:14}}>
            <Plus size={16}/> Add
          </button>
        </div>

        {/* Filter tabs - scrollable */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" style={{WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
          {[{id:'all',label:'All'}, ...TYPES].map(t => (
            <button key={t.id} onClick={() => setFilter(t.id)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: filter===t.id ? 'var(--accent)' : 'var(--surface)',
                color: filter===t.id ? 'white' : 'var(--text-sec)',
                border: `1.5px solid ${filter===t.id ? 'var(--accent)' : 'var(--border)'}`,
                minHeight: 36,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Services list */}
        {displayed.length === 0 ? (
          <div className="card text-center py-10">
            <Scissors size={32} className="mx-auto mb-3 opacity-30" style={{color:'var(--text-sec)'}}/>
            <p className="font-semibold mb-1" style={{color:'var(--text-pri)'}}>No services yet</p>
            <p className="text-sm mb-4" style={{color:'var(--text-sec)'}}>Add your first service to start booking</p>
            <button onClick={openAdd} className="btn-primary gap-2 mx-auto"><Plus size={16}/>Add Service</button>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(type => {
              const group = displayed.filter(s => s.serviceType === type)
              if (!group.length) return null
              return (
                <div key={type}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'var(--text-sec)'}}>{groupTitles[type]}</p>
                  <div className="space-y-2">
                    {group.map(svc => (
                      <div key={svc.id} className="card" style={{opacity: svc.isActive ? 1 : 0.5}}>
                        {/* Top row: name + actions */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm truncate" style={{color:'var(--text-pri)'}}>{svc.name}</p>
                              {!svc.isActive && <span className="badge-muted text-[10px] px-1.5 py-0.5 flex-shrink-0">Hidden</span>}
                            </div>
                            {svc.description && <p className="text-xs mt-0.5 truncate" style={{color:'var(--text-sec)'}}>{svc.description}</p>}
                            <p className="text-xs mt-1" style={{color:'var(--text-sec)'}}>{formatDuration(svc.duration)}</p>
                          </div>
                          <p className="font-bold flex-shrink-0" style={{color:'var(--accent)'}}>{formatCurrency(svc.price)}</p>
                        </div>
                        {/* Action row */}
                        <div className="flex gap-1 pt-2" style={{borderTop:'1px solid var(--border)'}}>
                          <button onClick={() => openEdit(svc)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium"
                            style={{background:'var(--surface)',color:'var(--text-sec)'}}>
                            <Edit2 size={12}/> Edit
                          </button>
                          <button onClick={() => toggleActive(svc)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium"
                            style={{background:'var(--surface)',color:'var(--text-sec)'}}>
                            {svc.isActive ? <EyeOff size={12}/> : <Eye size={12}/>}
                            {svc.isActive ? 'Hide' : 'Show'}
                          </button>
                          <button onClick={() => setDeleteTarget(svc)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium"
                            style={{background:'#ef444410',color:'#f87171'}}>
                            <Trash2 size={12}/> Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Service' : 'Add Service'}>
        <div className="space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(t => (
              <button key={t.id} onClick={() => setForm(p => ({...p,serviceType:t.id}))}
                className="py-3 rounded-2xl text-center text-xs font-bold transition-all"
                style={{
                  background: form.serviceType===t.id ? 'var(--accent)' : 'var(--surface)',
                  color: form.serviceType===t.id ? 'white' : 'var(--text-sec)',
                  border: `1.5px solid ${form.serviceType===t.id ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                {t.label}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{color:'var(--text-sec)'}}>Name *</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Fade" className="input"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{color:'var(--text-sec)'}}>Price ($) *</label>
              <input value={form.price} onChange={set('price')} placeholder="30" className="input" type="number" inputMode="decimal" min="0"/>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{color:'var(--text-sec)'}}>Duration (min) *</label>
              <input value={form.duration} onChange={set('duration')} placeholder="35" className="input" type="number" inputMode="numeric" min="5"/>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{color:'var(--text-sec)'}}>Description (optional)</label>
            <textarea value={form.description} onChange={set('description')} placeholder="Brief description..." className="input resize-none" rows={2}/>
          </div>

          {/* Visible toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl" style={{background:'var(--surface)'}}>
            <div>
              <p className="text-sm font-semibold" style={{color:'var(--text-pri)'}}>Visible to clients</p>
              <p className="text-xs" style={{color:'var(--text-sec)'}}>Show on booking page</p>
            </div>
            <button onClick={() => setForm(p => ({...p,isActive:!p.isActive}))}
              className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
              style={{background: form.isActive ? 'var(--accent)' : 'var(--border)'}}>
              <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                style={{left: form.isActive ? '26px' : '2px'}}/>
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              {saving ? 'Saving...' : editTarget ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Service">
        <p className="text-sm mb-4" style={{color:'var(--text-sec)'}}>
          <span style={{color:'var(--text-pri)',fontWeight:600}}>"{deleteTarget?.name}"</span> will be hidden. Past bookings are preserved.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Keep</button>
          <button onClick={handleDelete}
            className="flex-1 p-3 rounded-2xl font-semibold text-sm"
            style={{background:'#ef444415',color:'#f87171',border:'1px solid #ef444433'}}>
            Remove
          </button>
        </div>
      </Modal>
    </BarberLayout>
  )
}