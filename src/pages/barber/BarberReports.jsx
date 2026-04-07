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
      <div className="p-4 max-w-xl mx-auto w-full overflow-x-hidden">
        <h1 className="text-xl font-bold mb-1" style={{fontFamily:'Syne,sans-serif',color:'var(--text-pri)'}}>Reports</h1>
        <p className="text-xs mb-4" style={{color:'var(--text-sec)'}}>Business overview</p>

        {/* Period selector */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{WebkitOverflowScrolling:'touch',scrollbarWidth:'none'}}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold"
              style={{
                background: period===p ? 'var(--accent)' : 'var(--surface)',
                color: period===p ? 'white' : 'var(--text-sec)',
                border: `1.5px solid ${period===p ? 'var(--accent)' : 'var(--border)'}`,
                minHeight:36,
              }}>
              {p}
            </button>
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatCard icon={<DollarSign size={18}/>}  label="Revenue" value={formatCurrency(revenue)} color="#4ade80" bg="#16A34A15"/>
          <StatCard icon={<Calendar size={18}/>}    label="Appointments" value={filtered.length} color="#60a5fa" bg="#3b82f615"/>
          <StatCard icon={<TrendingUp size={18}/>}  label="Pending" value={formatCurrency(pending)} color="#fbbf24" bg="#f59e0b15"/>
          <StatCard icon={<Star size={18}/>}        label="All-Time" value={formatCurrency(totalAll)} color="var(--accent)" bg="var(--accent)15"/>
        </div>

        {/* Top services */}
        {topServices.length > 0 && (
          <div className="card mb-4">
            <p className="font-bold text-sm mb-3" style={{color:'var(--text-pri)'}}>Top Services</p>
            <div className="space-y-2">
              {topServices.map(([name,data],i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-center" style={{color:'var(--text-sec)'}}>{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-semibold truncate" style={{color:'var(--text-pri)'}}>{name}</span>
                      <span className="text-xs ml-2 flex-shrink-0" style={{color:'var(--text-sec)'}}>{data.count}x · {formatCurrency(data.revenue)}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{background:'var(--border)'}}>
                      <div className="h-full rounded-full" style={{background:'var(--accent)',width:`${Math.min(100,(data.count/topServices[0][1].count)*100)}%`}}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top clients */}
        {topClients.length > 0 && (
          <div className="card">
            <p className="font-bold text-sm mb-3" style={{color:'var(--text-pri)'}}>Top Clients</p>
            <div className="space-y-2">
              {topClients.map(([name,data],i) => (
                <div key={name} className="flex items-center justify-between gap-3 py-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold w-5 text-center" style={{color:'var(--text-sec)'}}>{i+1}</span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{background: data.isGuest ? '#8b5cf622' : 'var(--accent)22', color: data.isGuest ? '#a78bfa' : 'var(--accent)'}}>
                      {name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{color:'var(--text-pri)'}}>{name}</p>
                      <p className="text-xs" style={{color:'var(--text-sec)'}}>{data.count} visit{data.count!==1?'s':''}</p>
                    </div>
                  </div>
                  <p className="font-bold text-sm" style={{color:'var(--accent)'}}>{formatCurrency(data.revenue)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="card text-center py-10">
            <TrendingUp size={28} className="mx-auto mb-2 opacity-30" style={{color:'var(--text-sec)'}}/>
            <p className="text-sm" style={{color:'var(--text-sec)'}}>No data for this period</p>
          </div>
        )}

        {/* Cancelled appointments section */}
        {(() => {
          const cancelled = appointments.filter(a => a.bookingStatus === 'cancelled')
          if (cancelled.length === 0) return null
          return (
            <div className="card mt-4">
              <p className="font-bold text-sm mb-3 flex items-center gap-2" style={{color:'var(--text-pri)'}}>
                <span style={{width:10,height:10,borderRadius:'50%',background:'#f87171',display:'inline-block'}}/>
                Cancelled Appointments ({cancelled.length})
              </p>
              <div className="space-y-2">
                {cancelled.map(a => (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-2 rounded-xl" style={{background:'var(--surface)',opacity:0.7}}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{color:'var(--text-pri)'}}>{a.clientName}</p>
                      <p className="text-xs" style={{color:'var(--text-sec)'}}>{a.date} · {a.startTime}</p>
                      {a.cancelReason && <p className="text-xs" style={{color:'#f87171'}}>Reason: {a.cancelReason}</p>}
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{color:'#f87171'}}>{formatCurrency(a.totalPrice)}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>
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
