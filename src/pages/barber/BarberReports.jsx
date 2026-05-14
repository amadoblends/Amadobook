/**
 * BarberReports — rediseño premium con gráficas SVG y donut chart
 * Igual al template: negro · naranja · earnings overview · top services · donut
 */
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, parseLocalDate } from '../../utils/helpers'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'
import { TrendingUp, Scissors, ChevronRight } from 'lucide-react'

const BG     = '#0D0D0D'
const CARD   = '#171717'
const CARD2  = '#1C1C1E'
const BORDER = '#2A2A2A'
const ORANGE = '#FF6B1A'
const TXT    = '#F5F5F5'
const TXT2   = '#888888'
const TXT3   = '#555555'
const GREEN  = '#22C55E'
const BLUE   = '#3B82F6'
const PURPLE = '#A78BFA'
const F      = { fontFamily: "'DM Sans',system-ui,sans-serif" }

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin   { to { transform: rotate(360deg); } }
  .fade-up { animation: fadeUp 0.3s ease both; }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { display: none; }
`

const PERIODS = ['Today','This Week','This Month','All Time']
const SVC_COLORS = [ORANGE, GREEN, BLUE, PURPLE, '#F43F5E', '#FB923C']

// ── SVG Bar chart ─────────────────────────────────────────────────────────────
function BarChart({ data, maxVal, activeKey, onBarClick }) {
  const W = 320, H = 100, PAD = 4
  const barW = (W - PAD * (data.length - 1)) / data.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {data.map((m, i) => {
        const x    = i * (barW + PAD)
        const pct  = maxVal > 0 ? m.total / maxVal : 0
        const svcH = maxVal > 0 ? (m.services / maxVal) * (H - 4) : 0
        const tipH = maxVal > 0 ? (m.tips / maxVal) * (H - 4) : 0
        const isActive = activeKey === m.key
        const isEmpty  = m.total === 0

        return (
          <g key={m.key} onClick={() => onBarClick(m)} style={{ cursor: 'pointer' }}>
            {/* Background bar */}
            <rect x={x} y={0} width={barW} height={H} fill="transparent" />
            {isEmpty ? (
              <rect x={x} y={H - 3} width={barW} height={3} rx={1.5} fill={BORDER} opacity={0.5} />
            ) : (
              <>
                {/* Services (green) */}
                <rect
                  x={x} y={H - svcH} width={barW} height={svcH}
                  rx={svcH === H - 4 ? 4 : 0}
                  fill={isActive ? GREEN : `${GREEN}80`}
                  style={{ transition: 'fill 0.2s' }}
                />
                {/* Tips (orange) on top */}
                {tipH > 0 && (
                  <rect
                    x={x} y={H - svcH - tipH} width={barW} height={tipH}
                    rx={4}
                    fill={isActive ? ORANGE : `${ORANGE}80`}
                    style={{ transition: 'fill 0.2s' }}
                  />
                )}
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── SVG Donut chart ───────────────────────────────────────────────────────────
function DonutChart({ segments, size = 120, strokeWidth = 18 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null
  const R = (size - strokeWidth) / 2
  const C = size / 2
  const circumference = 2 * Math.PI * R
  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={C} cy={C} r={R} fill="none" stroke={BORDER} strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const pct  = seg.value / total
        const dash = pct * circumference
        const gap  = circumference - dash
        const dashOffset = -(offset * circumference)
        offset += pct
        return (
          <circle
            key={i} cx={C} cy={C} r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        )
      })}
    </svg>
  )
}

export default function BarberReports() {
  const { user } = useAuth()
  const [barber,       setBarber]       = useState(null)
  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [period,       setPeriod]       = useState('This Week')
  const [activeMonth,  setActiveMonth]  = useState(null)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    if (!user) return
    async function load() {
      const bSnap = await getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
      setBarber(b)
      const aSnap = await getDocs(query(collection(db,'appointments'), where('barberId','==',b.id)))
      setAppointments(aSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    load()
  }, [user])

  // Filter by period
  function inPeriod(a) {
    if (a.bookingStatus === 'cancelled') return false
    const d = a.date
    const today = format(new Date(), 'yyyy-MM-dd')
    if (period === 'Today') return d === today
    if (period === 'This Week') {
      const s = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const e = format(endOfWeek(new Date(),   { weekStartsOn: 1 }), 'yyyy-MM-dd')
      return d >= s && d <= e
    }
    if (period === 'This Month') {
      const s = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const e = format(endOfMonth(new Date()),   'yyyy-MM-dd')
      return d >= s && d <= e
    }
    return true
  }

  const filtered   = appointments.filter(inPeriod)
  const paid       = filtered.filter(a => a.paymentStatus === 'paid')
  const services   = paid.reduce((s, a) => s + (a.totalPrice || 0), 0)
  const tips       = paid.reduce((s, a) => s + (a.tip || 0), 0)
  const revenue    = services + tips
  const pending    = filtered.filter(a => a.paymentStatus !== 'paid').reduce((s,a) => s + (a.totalPrice||0), 0)
  const efficiency = filtered.length > 0
    ? Math.round((filtered.filter(a => a.bookingStatus === 'completed').length / filtered.length) * 100)
    : 0

  // Monthly chart (last 6 months)
  const months = eachMonthOfInterval({ start: subMonths(new Date(), 5), end: new Date() })
  const monthlyData = months.map(m => {
    const key   = format(m, 'yyyy-MM')
    const appts = appointments.filter(a => a.date?.startsWith(key) && a.paymentStatus === 'paid' && a.bookingStatus !== 'cancelled')
    const svc   = appts.reduce((s, a) => s + (a.totalPrice || 0), 0)
    const tip   = appts.reduce((s, a) => s + (a.tip || 0), 0)
    return { label: format(m, 'MMM'), key, services: svc, tips: tip, total: svc + tip, count: appts.length, appts }
  })
  const maxRev = Math.max(...monthlyData.map(m => m.total), 1)

  // Top services
  const svcMap = {}
  filtered.forEach(a => a.services?.forEach(s => {
    if (!svcMap[s.name]) svcMap[s.name] = { count: 0, revenue: 0 }
    svcMap[s.name].count++
    svcMap[s.name].revenue += (s.price || 0)
  }))
  const topServices = Object.entries(svcMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5)
  const totalSvcRev = topServices.reduce((s, [, d]) => s + d.revenue, 0)

  // Donut segments
  const donutSegments = topServices.slice(0, 5).map(([name, data], i) => ({
    label: name,
    value: data.revenue,
    color: SVC_COLORS[i] || TXT3,
    pct: totalSvcRev > 0 ? Math.round((data.revenue / totalSvcRev) * 100) : 0,
  }))

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  const activeMonthData = monthlyData.find(m => m.key === activeMonth)

  return (
    <BarberLayout>
      <style>{CSS}</style>
      <div style={{ background: BG, minHeight: '100vh', paddingBottom: 80, ...F }}>
        <div style={{ padding: '16px 18px', maxWidth: 640, margin: '0 auto' }}>

          {/* ── Header ── */}
          <div className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h1 style={{ color: TXT, fontWeight: 800, fontSize: 22, margin: '0 0 2px', letterSpacing: '-0.4px' }}>Reports</h1>
              <p style={{ color: TXT2, fontSize: 13, margin: 0 }}>Business overview</p>
            </div>
            {/* Period dropdown look */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: TXT, fontSize: 13, fontWeight: 600 }}>{period}</span>
              <ChevronRight size={13} color={TXT3}/>
            </div>
          </div>

          {/* Period chips */}
          <div className="fade-up" style={{ display: 'flex', gap: 6, marginBottom: 18, overflowX: 'auto', paddingBottom: 2 }}>
            {PERIODS.map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 22, border: `1.5px solid ${period===p?ORANGE:BORDER}`, background: period===p?ORANGE:'transparent', color: period===p?'#fff':TXT2, fontWeight: 700, fontSize: 12, cursor: 'pointer', ...F, transition: 'all 0.15s', boxShadow: period===p?`0 4px 12px ${ORANGE}33`:'none' }}>
                {p}
              </button>
            ))}
          </div>

          {/* ── Big stats card ── */}
          <div className="fade-up" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <p style={{ color: TXT2, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', margin: '0 0 6px' }}>TOTAL EARNINGS</p>
                <p style={{ color: TXT, fontWeight: 900, fontSize: 36, margin: 0, letterSpacing: '-1px' }}>{formatCurrency(revenue)}</p>
                <p style={{ color: GREEN, fontSize: 12, fontWeight: 700, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <TrendingUp size={12}/> +{efficiency}% efficiency
                </p>
              </div>
              <div style={{ background: `${ORANGE}18`, border: `1px solid ${ORANGE}33`, borderRadius: 14, padding: '10px 14px', textAlign: 'center' }}>
                <p style={{ color: ORANGE, fontWeight: 900, fontSize: 20, margin: '0 0 2px' }}>{filtered.length}</p>
                <p style={{ color: TXT3, fontSize: 10, fontWeight: 700, margin: 0, letterSpacing: '0.06em' }}>APPTS</p>
              </div>
            </div>

            {/* Mini stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Appointments', value: filtered.length, color: TXT },
                { label: 'Efficiency',   value: `${efficiency}%`, color: ORANGE },
                { label: 'Pending',      value: formatCurrency(pending), color: '#EAB308' },
              ].map(s => (
                <div key={s.label} style={{ background: BG, borderRadius: 12, padding: '10px' }}>
                  <p style={{ color: s.color, fontWeight: 800, fontSize: 18, margin: '0 0 3px', letterSpacing: '-0.3px' }}>{s.value}</p>
                  <p style={{ color: TXT3, fontSize: 10, margin: 0, fontWeight: 600 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Earnings Overview (bar chart) ── */}
          <div className="fade-up" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ color: TXT, fontWeight: 700, fontSize: 15, margin: 0 }}>Earnings Overview</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: GREEN }}/><span style={{ color: TXT2, fontSize: 11 }}>Services</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: ORANGE }}/><span style={{ color: TXT2, fontSize: 11 }}>Tips</span>
                </div>
              </div>
            </div>

            <BarChart
              data={monthlyData}
              maxVal={maxRev}
              activeKey={activeMonth}
              onBarClick={m => setActiveMonth(prev => prev === m.key ? null : m.key)}
            />

            {/* Month labels */}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {monthlyData.map((m, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <span style={{ color: activeMonth === m.key ? ORANGE : TXT3, fontSize: 10, fontWeight: 700, transition: 'color 0.2s' }}>{m.label}</span>
                </div>
              ))}
            </div>

            {/* Active month detail */}
            {activeMonthData && (
              <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '14px', marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ color: TXT, fontWeight: 700, fontSize: 14, margin: 0 }}>
                    {format(new Date(activeMonthData.key + '-01'), 'MMMM yyyy')}
                  </p>
                  <span style={{ color: ORANGE, fontWeight: 800, fontSize: 15 }}>{formatCurrency(activeMonthData.total)}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <span style={{ color: GREEN, fontWeight: 700, fontSize: 13 }}>Services {formatCurrency(activeMonthData.services)}</span>
                  <span style={{ color: ORANGE, fontWeight: 700, fontSize: 13 }}>Tips {formatCurrency(activeMonthData.tips)}</span>
                  <span style={{ color: TXT2, fontSize: 13 }}>{activeMonthData.count} appts</span>
                </div>
                {activeMonthData.appts.slice(0, 4).map((a, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: `1px solid ${BORDER}` }}>
                    <span style={{ color: TXT2, fontSize: 12 }}>{a.clientName} · {a.date}</span>
                    <span style={{ color: TXT, fontWeight: 700, fontSize: 12 }}>{formatCurrency(a.totalWithTip || a.totalPrice)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Top Services + Donut ── */}
          {topServices.length > 0 && (
            <div className="fade-up" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '18px', marginBottom: 12 }}>
              <p style={{ color: TXT, fontWeight: 700, fontSize: 15, margin: '0 0 16px' }}>Top Services</p>

              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Donut */}
                <div style={{ flexShrink: 0, position: 'relative' }}>
                  <DonutChart segments={donutSegments} size={120} strokeWidth={16} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: TXT, fontWeight: 900, fontSize: 14, margin: 0, letterSpacing: '-0.3px' }}>{formatCurrency(totalSvcRev)}</p>
                    <p style={{ color: TXT3, fontSize: 9, fontWeight: 700, margin: 0 }}>TOTAL</p>
                  </div>
                </div>

                {/* Legend */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {donutSegments.map((seg, i) => (
                    <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                      <span style={{ color: TXT, fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
                      <span style={{ color: TXT2, fontSize: 12 }}>{seg.pct}%</span>
                      <span style={{ color: ORANGE, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{formatCurrency(seg.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Services detail bars ── */}
          {topServices.length > 0 && (
            <div className="fade-up" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: '18px' }}>
              <p style={{ color: TXT, fontWeight: 700, fontSize: 15, margin: '0 0 16px' }}>Earnings by Service</p>
              {topServices.map(([name, data], i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < topServices.length - 1 ? 16 : 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: CARD2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Scissors size={15} color={SVC_COLORS[i] || TXT3} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ color: TXT, fontSize: 14, fontWeight: 600 }}>{name}</span>
                      <div>
                        <span style={{ color: SVC_COLORS[i] || ORANGE, fontWeight: 800, fontSize: 14 }}>{formatCurrency(data.revenue)}</span>
                        <span style={{ color: TXT3, fontSize: 11, marginLeft: 6 }}>{data.count}x</span>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: BORDER, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: SVC_COLORS[i] || ORANGE, width: `${(data.revenue / topServices[0][1].revenue) * 100}%`, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BarberLayout>
  )
}