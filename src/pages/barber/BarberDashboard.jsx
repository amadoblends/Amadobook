import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, getInitials } from '../../utils/helpers'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import BarberLayout from '../../components/layout/BarberLayout'
import Modal from '../../components/ui/Modal'
import { DollarSign, Calendar, Clock, XCircle, TrendingUp, Copy, ExternalLink, CheckCircle, User, Edit2, Save, X } from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

export default function BarberDashboard() {
  const { user } = useAuth()
  const [barber, setBarber]         = useState(null)
  const [todayAppts, setTodayAppts] = useState([])
  const [allAppts, setAllAppts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [actionAppt, setActionAppt] = useState(null)
  const [updating, setUpdating]     = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({})
  const [savingProfile, setSavingProfile] = useState(false)
  const refreshRef = useRef(null)
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // Auto-complete appointments that are past their end time
  async function autoCompletePastAppointments(barberId, appts) {
    const now = new Date()
    const toComplete = appts.filter(a => {
      if (a.bookingStatus !== 'confirmed' && a.bookingStatus !== 'pending') return false
      const [y, m, d] = a.date.split('-').map(Number)
      const [eh, em] = (a.endTime || '00:00').split(':').map(Number)
      const endDt = new Date(y, m - 1, d, eh, em, 0, 0)
      return endDt < now
    })
    for (const a of toComplete) {
      try {
        await updateDoc(doc(db, 'appointments', a.id), { bookingStatus: 'completed' })
      } catch {}
    }
  }

  async function loadData(barberId) {
    const [tSnap, aSnap] = await Promise.all([
      getDocs(query(collection(db, 'appointments'), where('barberId', '==', barberId), where('date', '==', todayStr))),
      getDocs(query(collection(db, 'appointments'), where('barberId', '==', barberId))),
    ])
    const all = aSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    all.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
    setTodayAppts(tSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    setAllAppts(all)
    // Auto-complete past appointments in background
    autoCompletePastAppointments(barberId, all).catch(() => {})
  }

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const bSnap = await getDocs(query(collection(db, 'barbers'), where('userId', '==', user.uid)))
        if (bSnap.empty) { setLoading(false); return }
        const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
        setBarber(b)
        setProfileForm({ name: b.name, bio: b.bio||'', address: b.address||'', phone: b.phone||'', photoURL: b.photoURL||'' })
        await loadData(b.id)
        // Ensure barber state is set after data loads (fixes mobile timing issue)
        setBarber(b)
      } catch (e) { console.error(e); toast.error('Failed to load') }
      finally { setLoading(false) }
    }
    load()
  }, [user])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!barber) return
    refreshRef.current = setInterval(() => loadData(barber.id), 20000)
    return () => clearInterval(refreshRef.current)
  }, [barber])

  async function updateAppt(id, updates) {
    setUpdating(true)
    try {
      await updateDoc(doc(db, 'appointments', id), updates)
      const patch = a => a.id===id ? {...a,...updates} : a
      setTodayAppts(p => p.map(patch))
      setAllAppts(p => p.map(patch))
      setActionAppt(null)
      toast.success('Updated!')
    } catch { toast.error('Could not update') }
    finally { setUpdating(false) }
  }

  async function saveProfile() {
    if (!barber || !profileForm.name?.trim()) return toast.error('Name is required')
    setSavingProfile(true)
    try {
      await updateDoc(doc(db, 'barbers', barber.id), {
        name: profileForm.name.trim(),
        bio: profileForm.bio.trim(),
        address: profileForm.address.trim(),
        phone: profileForm.phone.trim(),
        photoURL: profileForm.photoURL.trim(),
      })
      setBarber(p => ({ ...p, ...profileForm }))
      setEditProfile(false)
      toast.success('Profile updated!')
    } catch { toast.error('Could not save') }
    finally { setSavingProfile(false) }
  }

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  const todayActive  = todayAppts.filter(a => a.bookingStatus !== 'cancelled')
  const todayRevenue = todayAppts.filter(a => a.paymentStatus === 'paid').reduce((s,a) => s+(a.totalPrice||0), 0)
  const todayPending = todayAppts.filter(a => a.paymentStatus === 'pending' && a.bookingStatus !== 'cancelled').reduce((s,a) => s+(a.totalPrice||0), 0)
  const totalRevenue = allAppts.filter(a => a.paymentStatus === 'paid').reduce((s,a) => s+(a.totalPrice||0), 0)
  const publicLink   = `${window.location.origin}/b/${barber?.slug}`

  if (!barber) return (
    <BarberLayout>
      <div className="p-6 max-w-xl mx-auto">
        <div className="card text-center py-12">
          <User size={40} style={{color:'var(--text-sec)'}} className="mx-auto mb-3"/>
          <h2 className="font-bold text-lg mb-2" style={{color:'var(--text-pri)'}}>Profile not set up</h2>
          <p className="text-sm" style={{color:'var(--text-sec)'}}>Sign out and sign up again.</p>
        </div>
      </div>
    </BarberLayout>
  )

  return (
    <BarberLayout>
      <div className="p-4 max-w-4xl mx-auto">
        {/* Profile card */}
        <div className="card mb-4 flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{background:'var(--accent)22',border:'2px solid var(--accent)44'}}>
            {barber.photoURL
              ? <img src={barber.photoURL} alt="" className="w-full h-full object-cover"/>
              : <span className="font-bold text-lg" style={{color:'var(--accent)'}}>{getInitials(barber.name)}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold" style={{fontFamily:'Syne,sans-serif',color:'var(--text-pri)'}}>{barber.name}</h1>
                {barber.address && <p className="text-xs mt-0.5" style={{color:'var(--text-sec)'}}>{barber.address}</p>}
                {barber.bio && <p className="text-xs mt-1 leading-relaxed" style={{color:'var(--text-sec)'}}>{barber.bio}</p>}
              </div>
              <button onClick={() => setEditProfile(true)} className="btn-ghost p-2 flex-shrink-0" style={{minHeight:'auto'}}>
                <Edit2 size={16} style={{color:'var(--text-sec)'}}/>
              </button>
            </div>
            <p className="text-xs mt-1" style={{color:'var(--text-sec)'}}>{format(new Date(),'EEEE, MMMM d, yyyy')}</p>
          </div>
        </div>

        {/* Booking link */}
        <div className="mb-4 p-4 rounded-2xl flex items-center justify-between gap-3" style={{background:'var(--accent)12',border:'1px solid var(--accent)33'}}>
          <div className="min-w-0">
            <p className="text-xs font-bold mb-0.5" style={{color:'var(--accent)'}}>Your Client Booking Link</p>
            <p className="text-sm truncate" style={{color:'var(--text-pri)'}}>{publicLink}</p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => { navigator.clipboard.writeText(publicLink); toast.success('Copied!') }} className="btn-ghost p-2" style={{color:'var(--accent)',minHeight:'auto'}}><Copy size={16}/></button>
            <a href={publicLink} target="_blank" rel="noreferrer" className="btn-ghost p-2" style={{color:'var(--accent)',minHeight:'auto'}}><ExternalLink size={16}/></a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard icon={<Calendar size={18}/>}    label="Today"         value={todayActive.length}          color="#60a5fa" bg="#3b82f615"/>
          <StatCard icon={<DollarSign size={18}/>}  label="Revenue Today" value={formatCurrency(todayRevenue)} color="#4ade80" bg="#16A34A15"/>
          <StatCard icon={<Clock size={18}/>}        label="Pending"       value={formatCurrency(todayPending)} color="#fbbf24" bg="#f59e0b15"/>
          <StatCard icon={<XCircle size={18}/>}      label="Cancelled"     value={todayAppts.filter(a=>a.bookingStatus==='cancelled').length} color="#f87171" bg="#ef444415"/>
        </div>

        <div className="card mb-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} style={{color:'var(--accent)'}}/><span className="text-xs font-bold uppercase tracking-wider" style={{color:'var(--text-sec)'}}>All-Time Revenue</span></div>
          <p className="text-3xl font-bold" style={{fontFamily:'Syne,sans-serif',color:'var(--accent)'}}>{formatCurrency(totalRevenue)}</p>
          <p className="text-xs mt-1" style={{color:'var(--text-sec)'}}>{allAppts.filter(a=>a.paymentStatus==='paid').length} paid appointments</p>
        </div>

        <h2 className="text-lg font-bold mb-3" style={{fontFamily:'Syne,sans-serif',color:'var(--text-pri)'}}>Today's Appointments</h2>
        {todayAppts.length === 0 ? (
          <div className="card text-center py-10"><Calendar size={28} className="mx-auto mb-2 opacity-40" style={{color:'var(--text-sec)'}}/><p className="text-sm" style={{color:'var(--text-sec)'}}>No appointments today</p></div>
        ) : (
          <div className="space-y-2">
            {todayAppts.sort((a,b)=>a.startTime.localeCompare(b.startTime)).map(appt => (
              <button key={appt.id} onClick={() => setActionAppt(appt)} className="w-full text-left card flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 text-white"
                  style={{background: appt.isGuest ? '#8b5cf6' : 'var(--accent)'}}>
                  {getInitials(appt.clientName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{color:'var(--text-pri)'}}>{appt.clientName}</p>
                    {appt.isGuest && <span className="badge-guest">Guest</span>}
                    <span className={appt.bookingStatus==='completed'?'badge-success':appt.bookingStatus==='cancelled'?'badge-danger':'badge-info'}>{appt.bookingStatus}</span>
                    <span className={appt.paymentStatus==='paid'?'badge-success':'badge-warning'}>{appt.paymentStatus}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{color:'var(--text-sec)'}}>{appt.startTime} · {formatDuration(appt.totalDuration)} · {appt.services?.map(s=>s.name).join(', ')}</p>
                </div>
                <p className="font-bold text-sm flex-shrink-0" style={{color:'var(--accent)'}}>{formatCurrency(appt.totalPrice)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      <Modal isOpen={!!actionAppt} onClose={() => setActionAppt(null)} title="Update Appointment">
        {actionAppt && (
          <div>
            <div className="mb-4 p-3 rounded-2xl" style={{background:'var(--surface)'}}>
              <div className="flex items-center gap-2 mb-1">
                <p className="font-bold" style={{color:'var(--text-pri)'}}>{actionAppt.clientName}</p>
                {actionAppt.isGuest && <span className="badge-guest">Guest</span>}
              </div>
              <p className="text-xs" style={{color:'var(--text-sec)'}}>{actionAppt.clientEmail}</p>
              <p className="font-bold mt-1" style={{color:'var(--accent)'}}>{formatCurrency(actionAppt.totalPrice)}</p>
            </div>
            <div className="space-y-2">
              {actionAppt.bookingStatus !== 'completed' && (
                <button disabled={updating} onClick={() => updateAppt(actionAppt.id,{bookingStatus:'completed'})}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl font-semibold text-sm"
                  style={{background:'#16A34A15',color:'#4ade80',border:'1px solid #16A34A33'}}>
                  <CheckCircle size={16}/> Mark Completed
                </button>
              )}
              {actionAppt.paymentStatus !== 'paid' && actionAppt.bookingStatus !== 'cancelled' && (
                <button disabled={updating} onClick={() => updateAppt(actionAppt.id,{paymentStatus:'paid'})}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl font-semibold text-sm"
                  style={{background:'#3b82f615',color:'#60a5fa',border:'1px solid #3b82f633'}}>
                  <DollarSign size={16}/> Mark Paid
                </button>
              )}
              {actionAppt.bookingStatus !== 'cancelled' && (
                <button disabled={updating} onClick={() => updateAppt(actionAppt.id,{bookingStatus:'cancelled',paymentStatus:'cancelled'})}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl font-semibold text-sm"
                  style={{background:'#ef444415',color:'#f87171',border:'1px solid #ef444433'}}>
                  <XCircle size={16}/> Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Profile Modal */}
      <Modal isOpen={editProfile} onClose={() => setEditProfile(false)} title="Edit Profile">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{color:'var(--text-sec)'}}>Photo URL</label>
            <input value={profileForm.photoURL||''} onChange={e => setProfileForm(p=>({...p,photoURL:e.target.value}))} placeholder="https://..." className="input"/>
            {profileForm.photoURL && <img src={profileForm.photoURL} alt="" className="w-16 h-16 rounded-2xl object-cover mt-2"/>}
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{color:'var(--text-sec)'}}>Shop Name</label>
            <input value={profileForm.name||''} onChange={e => setProfileForm(p=>({...p,name:e.target.value}))} className="input"/>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{color:'var(--text-sec)'}}>Bio</label>
            <textarea value={profileForm.bio||''} onChange={e => setProfileForm(p=>({...p,bio:e.target.value}))} rows={2} className="input resize-none"/>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{color:'var(--text-sec)'}}>Address</label>
            <input value={profileForm.address||''} onChange={e => setProfileForm(p=>({...p,address:e.target.value}))} className="input"/>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{color:'var(--text-sec)'}}>Phone</label>
            <input value={profileForm.phone||''} onChange={e => setProfileForm(p=>({...p,phone:e.target.value}))} className="input" type="tel"/>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditProfile(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={saveProfile} disabled={savingProfile} className="btn-primary flex-1 gap-2">
              {savingProfile && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </Modal>
    </BarberLayout>
  )
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className="card">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{background:bg,color}}>
        {icon}
      </div>
      <p className="text-xl font-bold" style={{fontFamily:'Syne,sans-serif',color}}>{value}</p>
      <p className="text-xs mt-0.5" style={{color:'var(--text-sec)'}}>{label}</p>
    </div>
  )
}
