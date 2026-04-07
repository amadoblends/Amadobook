import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../utils/helpers'
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { TrendingUp, DollarSign, Calendar, Users, Star } from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

const PERIODS = ['Today','This Week','This Month','All Time']

export default function BarberReports() {
  const { user } = useAuth()
  const [barber, setBarber]           = useState(null)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [period, setPeriod]           = useState('This Month')

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const bSnap = await getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
        if (bSnap.empty) { setLoading(false); return }
        const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
        setBarber(b)
        const aSnap = await getDocs(query(collection(db,'appointments'), where('barberId','==',b.id)))
        setAppointments(aSnap.docs.map(d => ({id:d.id,...d.data()})))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [user])

  function filterByPeriod(appts) {
    const now = new Date()
    const todayStr = format(now,'yyyy-MM-dd')
    return appts.filter(a => {
      if (a.bookingStatus === 'cancelled') return false
      const d = a.date
      if (period === 'Today') return d === todayStr
      if (period === 'This Week') {
        const s = format(startOfWeek(now,{weekStartsOn:1}),'yyyy-MM-dd')
        const e = format(endOfWeek(now,{weekStartsOn:1}),'yyyy-MM-dd')
        return d >= s && d <= e
      }
      if (period === 'This Month') {
        const s = format(startOfMonth(now),'yyyy-MM-dd')
        const e = format(endOfMonth(now),'yyyy-MM-dd')
        return d >= s && d <= e
      }
      return true
    })
  }

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  const filtered = filterByPeriod(appointments)
  const revenue  = filtered.filter(a => a.paymentStatus==='paid').reduce((s,a) => s+(a.totalPrice||0),0)
  const pending  = filtered.filter(a => a.paymentStatus!=='paid').reduce((s,a) => s+(a.totalPrice||0),0)
  const totalAll = appointments.filter(a => a.paymentStatus==='paid').reduce((s,a) => s+(a.totalPrice||0),0)

  // Top services
  const svcMap = {}
  filtered.forEach(a => a.services?.forEach(s => {
    if (!svcMap[s.name]) svcMap[s.name] = { count:0, revenue:0 }
    svcMap[s.name].count++
    svcMap[s.name].revenue += s.price||0
  }))
  const topServices = Object.entries(svcMap).sort((a,b) => b[1].count-a[1].count).slice(0,5)
  const maxSvcCount = topServices.length > 0 ? topServices[0][1].count : 1

  // Top clients
  const clientMap = {}
  filtered.forEach(a => {
    const k = a.clientName||'Guest'
    if (!clientMap[k]) clientMap[k] = { count:0, revenue:0, isGuest: a.isGuest }
    clientMap[k].count++
    clientMap[k].revenue += a.totalPrice||0
  })
  const topClients = Object.entries(clientMap).sort((a,b) => b[1].count-a[1].count).slice(0,5)

  return (
    <BarberLayout>
      <div className="p-4 max-w-4xl mx-auto w-full overflow-x-hidden">
        <h1 className="text-2xl font-bold mb-1" style={{fontFamily:'Syne,sans-serif',color:'var(--text-pri)'}}>Reports</h1>
        <p className="text-sm mb-6" style={{color:'var(--text-sec)'}}>Business overview</p>

        {/* Period selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2" style={{WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: period===p ? 'var(--accent)' : 'var(--surface)',
                color: period===p ? 'white' : 'var(--text-sec)',
                border: `1px solid ${period===p ? 'var(--accent)' : 'var(--border)'}`,
              }}>
              {p}
            </button>
          ))}
        </div>

        {/* Stats grid - Arreglado para móviles y PC */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<DollarSign size={20}/>}  label="Revenue" value={formatCurrency(revenue)} color="#4ade80" bg="#16A34A15"/>
          <StatCard icon={<Calendar size={20}/>}    label="Appointments" value={filtered.length} color="#60a5fa" bg="#3b82f615"/>
          <StatCard icon={<TrendingUp size={20}/>}  label="Pending" value={formatCurrency(pending)} color="#fbbf24" bg="#f59e0b15"/>
          <StatCard icon={<Star size={20}/>}        label="All-Time" value={formatCurrency(totalAll)} color="var(--accent)" bg="var(--accent)15"/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top services - Diseño limpio */}
          {topServices.length > 0 && (
            <div className="card p-5">
              <p className="font-bold text-base mb-4" style={{color:'var(--text-pri)'}}>Top Services</p>
              <div className="space-y-4">
                {topServices.map(([name,data],i) => (
                  <div key={name} className="relative">
                    <div className="flex justify-between items-center mb-2 relative z-10">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold w-5 text-center" style={{color:'var(--text-sec)'}}>{i+1}</span>
                        <span className="text-sm font-semibold" style={{color:'var(--text-pri)'}}>{name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold" style={{color:'var(--accent)'}}>{formatCurrency(data.revenue)}</span>
                        <span className="text-xs ml-2" style={{color:'var(--text-sec)'}}>{data.count}x</span>
                      </div>
                    </div>
                    {/* Barra de progreso sutil */}
                    <div className="h-1 w-full rounded-full overflow-hidden ml-8" style={{background:'var(--border)'}}>
                      <div className="h-full rounded-full transition-all duration-500" style={{background:'var(--accent)',width:`${(data.count/maxSvcCount)*100}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top clients */}
          {topClients.length > 0 && (
            <div className="card p-5">
              <p className="font-bold text-base mb-4" style={{color:'var(--text-pri)'}}>Top Clients</p>
              <div className="space-y-4">
                {topClients.map(([name,data],i) => (
                  <div key={name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold w-5 text-center" style={{color:'var(--text-sec)'}}>{i+1}</span>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{background: data.isGuest ? '#8b5cf622' : 'var(--accent)22', color: data.isGuest ? '#a78bfa' : 'var(--accent)'}}>
                        {name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{color:'var(--text-pri)'}}>{name}</p>
                        <p className="text-xs" style={{color:'var(--text-sec)'}}>{data.count} visit{data.count!==1?'s':''}</p>
                      </div>
                    </div>
                    <p className="font-bold text-sm" style={{color:'var(--accent)'}}>{formatCurrency(data.revenue)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {filtered.length === 0 && (
          <div className="card text-center py-12 mt-4">
            <TrendingUp size={32} className="mx-auto mb-3 opacity-30" style={{color:'var(--text-sec)'}}/>
            <p className="text-base font-medium" style={{color:'var(--text-sec)'}}>No data for this period</p>
          </div>
        )}
      </div>
    </BarberLayout>
  )
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className="card p-4 hover:scale-[1.02] transition-transform">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{background:bg,color}}>
        {icon}
      </div>
      <p className="text-2xl font-bold tracking-tight" style={{fontFamily:'Syne,sans-serif',color}}>{value}</p>
      <p className="text-xs font-medium mt-1 uppercase tracking-wider" style={{color:'var(--text-sec)'}}>{label}</p>
    </div>
  )
}