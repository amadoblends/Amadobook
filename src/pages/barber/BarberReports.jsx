import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, parseLocalDate } from '../../utils/helpers'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { TrendingUp, DollarSign, Calendar, Users } from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

const F = { fontFamily: 'Monda, sans-serif' }
const PERIODS = ['Today', 'This Week', 'This Month', 'All Time']
const HISTORY_FILTERS = ['All', 'Completed', 'Cancelled', 'Unpaid']

export default function BarberReports() {
  const { user } = useAuth()
  const [barber, setBarber]           = useState(null)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [period, setPeriod]           = useState('This Month')
  const [view, setView]               = useState('summary') // summary | history
  const [histFilter, setHistFilter]   = useState('All')

  useEffect(() => {
    if (!user) return
    async function load() {
      const bSnap = await getDocs(query(collection(db, 'barbers'), where('userId', '==', user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
      setBarber(b)
      const aSnap = await getDocs(query(collection(db, 'appointments'), where('barberId', '==', b.id)))
      setAppointments(aSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    load()
  }, [user])

  function inPeriod(appt) {
    if (appt.bookingStatus === 'cancelled') return false
    const d = appt.date
    const today = format(new Date(), 'yyyy-MM-dd')
    if (period === 'Today') return d === today
    if (period === 'This Week') {
      const s = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const e = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      return d >= s && d <= e
    }
    if (period === 'This Month') {
      const s = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const e = format(endOfMonth(new Date()), 'yyyy-MM-dd')
      return d >= s && d <= e
    }
    return true
  }

  const filtered     = appointments.filter(inPeriod)
  const revenue      = filtered.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.totalWithTip || a.totalPrice || 0), 0)
  const tips         = filtered.reduce((s, a) => s + (a.tip || 0), 0)
  const pending      = filtered.filter(a => a.paymentStatus !== 'paid').reduce((s, a) => s + (a.totalPrice || 0), 0)
  const allRevenue   = appointments.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.totalWithTip || a.totalPrice || 0), 0)

  // Top services
  const svcMap = {}
  filtered.forEach(a => a.services?.forEach(s => {
    if (!svcMap[s.name]) svcMap[s.name] = { count: 0, revenue: 0 }
    svcMap[s.name].count++
    svcMap[s.name].revenue += s.price || 0
  }))
  const topServices = Object.entries(svcMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5)

  // Monthly chart data (last 6 months)
  const months = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() })
  const monthlyData = months.map(m => {
    const key = format(m, 'yyyy-MM')
    const rev = appointments
      .filter(a => a.date?.startsWith(key) && a.paymentStatus === 'paid' && a.bookingStatus !== 'cancelled')
      .reduce((s, a) => s + (a.totalPrice || 0), 0)
    return { label: format(m, 'MMM'), revenue: rev }
  })
  const maxRev = Math.max(...monthlyData.map(m => m.revenue), 1)

  // History list
  const historyAppts = appointments.filter(a => {
    if (histFilter === 'Completed') return a.bookingStatus === 'completed'
    if (histFilter === 'Cancelled') return a.bookingStatus === 'cancelled'
    if (histFilter === 'Unpaid')    return a.paymentStatus !== 'paid' && a.bookingStatus !== 'cancelled'
    return true
  }).sort((a, b) => b.date?.localeCompare(a.date))

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  return (
    <BarberLayout>
      <div style={{ padding: '16px', maxWidth: 600, margin: '0 auto', ...F }}>
        <h1 style={{ fontFamily: "'Space Grotesk','Monda',sans-serif", color: 'var(--text-pri)', fontSize: 20, marginBottom: 4 }}>Reports</h1>
        <p style={{ color: 'var(--text-sec)', fontSize: 13, marginBottom: 16 }}>Business overview</p>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 12, padding: 4, marginBottom: 16, border: '1px solid var(--border)' }}>
          {['summary', 'history'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? 'white' : 'var(--text-sec)', ...F, textTransform: 'capitalize' }}>
              {v === 'summary' ? 'Overview' : 'History'}
            </button>
          ))}
        </div>

        {view === 'summary' && (
          <>
            {/* Period selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
              {PERIODS.map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`, background: period === p ? 'var(--accent)' : 'var(--surface)', color: period === p ? 'white' : 'var(--text-sec)', fontWeight: 700, fontSize: 12, cursor: 'pointer', ...F }}>
                  {p}
                </button>
              ))}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { icon: <DollarSign size={18} />, label: 'Revenue', value: formatCurrency(revenue), color: '#4ade80', bg: '#16A34A15' },
                { icon: <Calendar size={18} />, label: 'Appointments', value: filtered.length, color: '#60a5fa', bg: '#3b82f615' },
                { icon: <TrendingUp size={18} />, label: 'Pending', value: formatCurrency(pending), color: '#fbbf24', bg: '#f59e0b15' },
                { icon: <Users size={18} />, label: 'Tips', value: formatCurrency(tips), color: 'var(--accent)', bg: 'var(--accent)15' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 12px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>{s.icon}</div>
                  <p style={{ fontFamily: "'Space Grotesk','Monda',sans-serif", color: s.color, fontSize: 20, fontWeight: 900, margin: '0 0 2px' }}>{s.value}</p>
                  <p style={{ color: 'var(--text-sec)', fontSize: 11, margin: 0 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* All-time */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>ALL-TIME REVENUE</p>
              <p style={{ fontFamily: "'Space Grotesk','Monda',sans-serif", color: 'var(--accent)', fontSize: 28, fontWeight: 900, margin: 0 }}>{formatCurrency(allRevenue)}</p>
            </div>

            {/* Monthly chart */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 14 }}>MONTHLY REVENUE</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {monthlyData.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0',
                      background: i === monthlyData.length - 1 ? 'var(--accent)' : 'var(--accent)44',
                      height: m.revenue > 0 ? `${Math.max((m.revenue / maxRev) * 64, 4)}px` : '4px',
                      transition: 'height 0.3s',
                    }} />
                    <span style={{ color: 'var(--text-sec)', fontSize: 9, fontWeight: 700 }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top services */}
            {topServices.length > 0 && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px' }}>
                <p style={{ color: 'var(--text-sec)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>TOP SERVICES</p>
                {topServices.map(([name, data], i) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ color: 'var(--text-sec)', fontSize: 12, width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-pri)', fontSize: 13, fontWeight: 600, truncate: true }}>{name}</span>
                        <span style={{ color: 'var(--text-sec)', fontSize: 12 }}>{data.count}x · {formatCurrency(data.revenue)}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${(data.count / topServices[0][1].count) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === 'history' && (
          <>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
              {HISTORY_FILTERS.map(f => (
                <button key={f} onClick={() => setHistFilter(f)}
                  style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 20, border: `1.5px solid ${histFilter === f ? 'var(--accent)' : 'var(--border)'}`, background: histFilter === f ? 'var(--accent)' : 'var(--surface)', color: histFilter === f ? 'white' : 'var(--text-sec)', fontWeight: 700, fontSize: 12, cursor: 'pointer', ...F }}>
                  {f}
                </button>
              ))}
            </div>

            {historyAppts.length === 0 ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-sec)', margin: 0 }}>No appointments</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {historyAppts.map(a => {
                  const statusColors = { completed: '#4ade80', cancelled: '#f87171', confirmed: '#60a5fa', pending: '#fbbf24' }
                  return (
                    <div key={a.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `3px solid ${statusColors[a.bookingStatus] || '#555'}`, borderRadius: 14, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div>
                          <p style={{ color: 'var(--text-pri)', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>{a.clientName}</p>
                          <p style={{ color: 'var(--text-sec)', fontSize: 12, margin: 0 }}>
                            {a.date ? format(parseLocalDate(a.date), 'MMM d, yyyy') : '—'} · {a.startTime}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 14, margin: '0 0 2px' }}>{formatCurrency(a.totalPrice)}</p>
                          <p style={{ color: statusColors[a.bookingStatus] || '#555', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>{a.bookingStatus}</p>
                        </div>
                      </div>
                      {a.services?.length > 0 && (
                        <p style={{ color: 'var(--text-sec)', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.services.map(s => s.name).join(', ')}
                        </p>
                      )}
                      {a.cancelReason && <p style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>Reason: {a.cancelReason}</p>}
                      {a.tip > 0 && <p style={{ color: '#4ade80', fontSize: 11, marginTop: 2 }}>Tip: +{formatCurrency(a.tip)}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </BarberLayout>
  )
}
