import { useEffect, useState, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDuration, getInitials, parseLocalDate } from '../../utils/helpers'
import { format, isToday, isTomorrow, differenceInMinutes } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { useTheme } from '../../context/ThemeContext'
import { Calendar, DollarSign, Users, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const F = { fontFamily:'Monda,sans-serif' }
const SC = { pending:'#f59e0b', confirmed:'#16A34A', completed:'#3b82f6', cancelled:'#ef4444' }

export default function BarberDashboard() {
  const { user } = useAuth()
  const { formatTime } = useTheme()
  const [barber, setBarber]     = useState(null)
  const [allAppts, setAllAppts] = useState([])
  const [loading, setLoading]   = useState(true)
  const refreshRef = useRef(null)

  async function autoCompletePastAppointments(barberId, appts) {
    const now = new Date()
    const toComplete = appts.filter(a => {
      if (a.bookingStatus !== 'confirmed' && a.bookingStatus !== 'pending') return false
      const [y,m,d] = (a.date||'').split('-').map(Number)
      const [eh,em] = (a.endTime||'00:00').split(':').map(Number)
      return new Date(y,m-1,d,eh,em,0) < now
    })
    for (const a of toComplete) {
      try { await updateDoc(doc(db,'appointments',a.id), { bookingStatus:'completed' }) } catch {}
    }
    if (toComplete.length > 0) {
      setAllAppts(p => p.map(a => toComplete.find(t=>t.id===a.id) ? {...a, bookingStatus:'completed'} : a))
    }
  }

  async function loadData(barberId) {
    const snap = await getDocs(query(collection(db,'appointments'), where('barberId','==',barberId)))
    const all  = snap.docs.map(d=>({id:d.id,...d.data()}))
    setAllAppts(all)
    setLoading(false)
    autoCompletePastAppointments(barberId, all)
  }

  useEffect(() => {
    if (!user) return
    async function init() {
      const bSnap = await getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      const b = { id:bSnap.docs[0].id, ...bSnap.docs[0].data() }
      setBarber(b)
      await loadData(b.id)
    }
    init()
    refreshRef.current = setInterval(() => { if (barber) loadData(barber.id) }, 20000)
    return () => clearInterval(refreshRef.current)
  }, [user])

  useEffect(() => {
    if (barber) {
      clearInterval(refreshRef.current)
      refreshRef.current = setInterval(() => loadData(barber.id), 20000)
    }
    return () => clearInterval(refreshRef.current)
  }, [barber])

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  const today = format(new Date(),'yyyy-MM-dd')
  const active = allAppts.filter(a => a.bookingStatus !== 'cancelled')
  const todayAppts = active
    .filter(a => a.date === today)
    .sort((a,b) => a.startTime.localeCompare(b.startTime))
  const upcoming = active
    .filter(a => a.date > today)
    .sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0,5)

  const thisMonthKey = format(new Date(),'yyyy-MM')
  const monthRevenue = active
    .filter(a => a.date?.startsWith(thisMonthKey) && a.paymentStatus==='paid')
    .reduce((s,a) => s+(a.totalWithTip||a.totalPrice||0), 0)
  const pendingPay = active
    .filter(a => a.paymentStatus!=='paid' && a.bookingStatus!=='cancelled')
    .reduce((s,a) => s+(a.totalPrice||0), 0)
  const totalClients = new Set(active.map(a=>a.clientEmail||a.clientName)).size

  const now = new Date()
  const currentAppt = todayAppts.find(a => {
    const [y,m,d] = a.date.split('-').map(Number)
    const [sh,sm] = a.startTime.split(':').map(Number)
    const [eh,em] = a.endTime.split(':').map(Number)
    const start = new Date(y,m-1,d,sh,sm)
    const end   = new Date(y,m-1,d,eh,em)
    return now >= start && now <= end
  })

  return (
    <BarberLayout>
      <div style={{ padding:'20px', maxWidth:640, margin:'0 auto', ...F }}>

        {/* Greeting */}
        <div style={{ marginBottom:20 }}>
          <p style={{ color:'var(--text-sec)', fontSize:13, margin:'0 0 2px' }}>
            {new Date().getHours()<12?'Good morning':new Date().getHours()<17?'Good afternoon':'Good evening'} 👋
          </p>
          <h1 style={{ fontFamily:"'Space Grotesk','Monda',sans-serif", color:'var(--text-pri)', fontSize:24, fontWeight:900, margin:0 }}>
            {barber?.name || 'Dashboard'}
          </h1>
        </div>

        {/* Currently serving */}
        {currentAppt && (
          <div style={{ background:'var(--accent)', borderRadius:16, padding:'16px', marginBottom:16, color:'white' }}>
            <p style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', margin:'0 0 6px', opacity:0.8 }}>NOW SERVING</p>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <p style={{ fontWeight:800, fontSize:18, margin:'0 0 2px' }}>{currentAppt.clientName}</p>
                <p style={{ opacity:0.8, fontSize:13, margin:0 }}>{currentAppt.services?.map(s=>s.name).join(', ')}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontWeight:900, fontSize:16, margin:'0 0 2px' }}>{formatCurrency(currentAppt.totalPrice)}</p>
                <p style={{ opacity:0.8, fontSize:12, margin:0 }}>{currentAppt.startTime} – {currentAppt.endTime}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          {[
            { icon:<DollarSign size={18}/>, label:'This Month', value:formatCurrency(monthRevenue), color:'#16A34A', bg:'#16A34A18' },
            { icon:<Clock size={18}/>, label:'Today', value:todayAppts.length, color:'var(--accent)', bg:'var(--accent)18' },
            { icon:<TrendingUp size={18}/>, label:'Pending Pay', value:formatCurrency(pendingPay), color:'#f59e0b', bg:'#f59e0b18' },
            { icon:<Users size={18}/>, label:'Total Clients', value:totalClients, color:'#3b82f6', bg:'#3b82f618' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'14px', boxShadow:'var(--shadow)' }}>
              <div style={{ width:36, height:36, borderRadius:10, background:s.bg, color:s.color, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>{s.icon}</div>
              <p style={{ fontFamily:"'Space Grotesk','Monda',sans-serif", color:s.color, fontSize:22, fontWeight:900, margin:'0 0 2px' }}>{s.value}</p>
              <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Today's schedule */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:16, boxShadow:'var(--shadow)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <p style={{ fontFamily:"'Space Grotesk','Monda',sans-serif", color:'var(--text-pri)', fontWeight:800, fontSize:16, margin:0 }}>Today</p>
            <span style={{ background:'var(--accent)20', color:'var(--accent)', fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20 }}>
              {todayAppts.length} appt{todayAppts.length!==1?'s':''}
            </span>
          </div>
          {todayAppts.length === 0 ? (
            <p style={{ color:'var(--text-sec)', fontSize:13, textAlign:'center', padding:'16px 0' }}>No appointments today</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {todayAppts.map(a => (
                <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:12, background:'var(--bg)', border:'1px solid var(--border)' }}>
                  <div style={{ flexShrink:0, textAlign:'center', minWidth:44 }}>
                    <p style={{ color:'var(--accent)', fontWeight:700, fontSize:13, margin:0 }}>{formatTime(a.startTime)}</p>
                    <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>{a.endTime}</p>
                  </div>
                  <div style={{ width:1, height:32, background:'var(--border)', flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:0 }}>{a.clientName}</p>
                      {a.isGuest && <span style={{ background:'#8b5cf622', color:'#7c3aed', fontSize:10, padding:'1px 6px', borderRadius:10, fontWeight:700 }}>Guest</span>}
                    </div>
                    <p style={{ color:'var(--text-sec)', fontSize:12, margin:'1px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {a.services?.map(s=>s.name).join(', ')}
                    </p>
                  </div>
                  <div style={{ flexShrink:0, textAlign:'right' }}>
                    <p style={{ color:'var(--accent)', fontWeight:800, fontSize:13, margin:'0 0 2px' }}>{formatCurrency(a.totalPrice)}</p>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:SC[a.bookingStatus]+'22', color:SC[a.bookingStatus] }}>
                      {a.bookingStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', boxShadow:'var(--shadow)' }}>
            <p style={{ fontFamily:"'Space Grotesk','Monda',sans-serif", color:'var(--text-pri)', fontWeight:800, fontSize:16, marginBottom:12 }}>Upcoming</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {upcoming.map(a => {
                const d = parseLocalDate(a.date)
                const label = isToday(d)?'Today':isTomorrow(d)?'Tomorrow':format(d,'MMM d')
                return (
                  <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:12, background:'var(--bg)', border:'1px solid var(--border)' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:'0 0 1px' }}>{a.clientName}</p>
                      <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>{label} · {a.startTime}</p>
                    </div>
                    <p style={{ color:'var(--accent)', fontWeight:800, fontSize:13, flexShrink:0 }}>{formatCurrency(a.totalPrice)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </BarberLayout>
  )
}
