/**
 * BarberReports — Services vs Tips split, payment method tracking, interactive charts
 */
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useBarberAuth as useAuth } from '../../hooks/useBarberAuth'
import { formatCurrency, parseLocalDate } from '../../utils/helpers'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { PageLoader } from '../../components/ui/Spinner'

const F = { fontFamily:'Monda,sans-serif' }
const PERIODS = ['Today','This Week','This Month','All Time']
const PAY_COLORS = { cash:'#22C55E', square:'#3B82F6', 'cash app':'#F59E0B', zelle:'#8B5CF6', other:'#6B7280' }

export default function BarberReports() {
  const { user } = useAuth()
  const [barber, setBarber]             = useState(null)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)
  const [period, setPeriod]             = useState('This Month')
  const [view, setView]                 = useState('summary')  // summary | history | payments
  const [histFilter, setHistFilter]     = useState('All')
  const [chartDetail, setChartDetail]   = useState(null)      // clicked month detail

  useEffect(() => {
    if (!user) return
    async function load() {
      const bSnap = await getDocs(query(collection(db,'barbers'),where('userId','==',user.uid)))
      if (bSnap.empty) { setLoading(false); return }
      const b = { id:bSnap.docs[0].id,...bSnap.docs[0].data() }
      setBarber(b)
      const aSnap = await getDocs(query(collection(db,'appointments'),where('barberId','==',b.id)))
      setAppointments(aSnap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    }
    load()
  },[user])

  function inPeriod(a) {
    if (a.bookingStatus==='cancelled') return false
    const d = a.date
    const today = format(new Date(),'yyyy-MM-dd')
    if (period==='Today')      return d===today
    if (period==='This Week') {
      const s = format(startOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd')
      const e = format(endOfWeek(new Date(),{weekStartsOn:1}),'yyyy-MM-dd')
      return d>=s && d<=e
    }
    if (period==='This Month') {
      const s = format(startOfMonth(new Date()),'yyyy-MM-dd')
      const e = format(endOfMonth(new Date()),'yyyy-MM-dd')
      return d>=s && d<=e
    }
    return true
  }

  const filtered   = appointments.filter(inPeriod)
  const paid       = filtered.filter(a=>a.paymentStatus==='paid')
  const services   = paid.reduce((s,a)=>s+(a.totalPrice||0),0)
  const tips       = paid.reduce((s,a)=>s+(a.tip||0),0)
  const revenue    = services + tips
  const pending    = filtered.filter(a=>a.paymentStatus!=='paid').reduce((s,a)=>s+(a.totalPrice||0),0)
  const allRevenue = appointments.filter(a=>a.paymentStatus==='paid').reduce((s,a)=>s+(a.totalWithTip||a.totalPrice||0),0)

  // Top services
  const svcMap = {}
  filtered.forEach(a=>a.services?.forEach(s=>{
    if (!svcMap[s.name]) svcMap[s.name]={count:0,revenue:0}
    svcMap[s.name].count++; svcMap[s.name].revenue+=s.price||0
  }))
  const topServices = Object.entries(svcMap).sort((a,b)=>b[1].count-a[1].count).slice(0,5)

  // Monthly chart — services + tips stacked
  const months = eachMonthOfInterval({ start:subMonths(new Date(),5), end:new Date() })
  const monthlyData = months.map(m=>{
    const key = format(m,'yyyy-MM')
    const appts = appointments.filter(a=>a.date?.startsWith(key)&&a.paymentStatus==='paid'&&a.bookingStatus!=='cancelled')
    const svc  = appts.reduce((s,a)=>s+(a.totalPrice||0),0)
    const tip  = appts.reduce((s,a)=>s+(a.tip||0),0)
    return { label:format(m,'MMM'), key, services:svc, tips:tip, total:svc+tip, appts }
  })
  const maxRev = Math.max(...monthlyData.map(m=>m.total),1)

  // Payment methods
  const payMap = {}
  appointments.filter(a=>a.paymentStatus==='paid').forEach(a=>{
    const pm = (a.paymentMethod||'cash').toLowerCase()
    if (!payMap[pm]) payMap[pm]={count:0,revenue:0}
    payMap[pm].count++
    payMap[pm].revenue+=(a.totalWithTip||a.totalPrice||0)
  })
  const payMethods = Object.entries(payMap).sort((a,b)=>b[1].revenue-a[1].revenue)
  const maxPayRev  = Math.max(...payMethods.map(p=>p[1].revenue),1)

  // History
  const historyAppts = appointments.filter(a=>{
    if (histFilter==='Completed') return a.bookingStatus==='completed'
    if (histFilter==='Cancelled') return a.bookingStatus==='cancelled'
    if (histFilter==='Unpaid')    return a.paymentStatus!=='paid'&&a.bookingStatus!=='cancelled'
    return true
  }).sort((a,b)=>b.date?.localeCompare(a.date))

  const statusColors = { completed:'#22C55E', cancelled:'#EF4444', confirmed:'#3B82F6', pending:'#F59E0B' }

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  return (
    <BarberLayout>
      <div style={{ padding:'16px', maxWidth:600, margin:'0 auto', ...F }}>
        <h1 style={{ color:'var(--text-pri)', fontSize:20, fontWeight:900, marginBottom:4 }}>Reports</h1>
        <p style={{ color:'var(--text-sec)', fontSize:13, marginBottom:16 }}>Business overview</p>

        {/* View toggle */}
        <div style={{ display:'flex', background:'var(--surface)', borderRadius:12, padding:3, marginBottom:16, border:'1px solid var(--border)' }}>
          {[['summary','Overview'],['payments','Payments'],['history','History']].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)}
              style={{ flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', fontWeight:700, fontSize:12, background:view===v?'var(--accent)':'transparent', color:view===v?'var(--accent-inv)':'var(--text-sec)', ...F }}>
              {l}
            </button>
          ))}
        </div>

        {/* ── SUMMARY ── */}
        {view==='summary' && (
          <>
            {/* Period chips */}
            <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', paddingBottom:2 }}>
              {PERIODS.map(p=>(
                <button key={p} onClick={()=>setPeriod(p)}
                  style={{ flexShrink:0, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${period===p?'var(--accent)':'var(--border)'}`, background:period===p?'var(--accent)':'transparent', color:period===p?'var(--accent-inv)':'var(--text-sec)', fontWeight:700, fontSize:12, cursor:'pointer', ...F }}>
                  {p}
                </button>
              ))}
            </div>

            {/* Services vs Tips split */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:12 }}>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:14 }}>EARNINGS BREAKDOWN</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                <div style={{ background:'var(--surface)', borderRadius:12, padding:'12px', border:'1px solid var(--border)' }}>
                  <p style={{ color:'#22C55E', fontWeight:900, fontSize:22, margin:'0 0 2px' }}>{formatCurrency(services)}</p>
                  <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>Services</p>
                </div>
                <div style={{ background:'var(--surface)', borderRadius:12, padding:'12px', border:'1px solid var(--border)' }}>
                  <p style={{ color:'var(--accent)', fontWeight:900, fontSize:22, margin:'0 0 2px' }}>{formatCurrency(tips)}</p>
                  <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>Tips</p>
                </div>
              </div>
              {/* Split bar */}
              {revenue>0 && (
                <div>
                  <div style={{ height:8, borderRadius:4, overflow:'hidden', background:'var(--border)', display:'flex' }}>
                    <div style={{ width:`${services/revenue*100}%`, background:'#22C55E', transition:'width 0.4s' }}/>
                    <div style={{ flex:1, background:'var(--accent)' }}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                    <span style={{ color:'#22C55E', fontSize:11, fontWeight:600 }}>Services {Math.round(services/revenue*100)}%</span>
                    <span style={{ color:'var(--accent)', fontSize:11, fontWeight:600 }}>Tips {Math.round(tips/revenue*100)}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'12px' }}>
                <p style={{ color:'var(--text-pri)', fontWeight:900, fontSize:20, margin:'0 0 2px' }}>{filtered.length}</p>
                <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>Appointments</p>
              </div>
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'12px' }}>
                <p style={{ color:'#EAB308', fontWeight:900, fontSize:20, margin:'0 0 2px' }}>{formatCurrency(pending)}</p>
                <p style={{ color:'var(--text-sec)', fontSize:11, margin:0 }}>Pending</p>
              </div>
            </div>

            {/* All-time */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', marginBottom:12 }}>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:4 }}>ALL-TIME REVENUE</p>
              <p style={{ color:'var(--accent)', fontSize:28, fontWeight:900, margin:0 }}>{formatCurrency(allRevenue)}</p>
            </div>

            {/* Monthly chart — services (solid) + tips (lighter) stacked */}
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', marginBottom:12 }}>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:14 }}>MONTHLY (tap for detail)</p>
              <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:90, marginBottom:8 }}>
                {monthlyData.map((m,i)=>(
                  <div key={i} onClick={()=>setChartDetail(chartDetail?.key===m.key?null:m)}
                    style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}>
                    <div style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'stretch', justifyContent:'flex-end', height:72, borderRadius:'3px 3px 0 0', overflow:'hidden', opacity:chartDetail&&chartDetail.key!==m.key?0.45:1, transition:'opacity 0.2s' }}>
                      {m.tips>0 && <div style={{ background:'var(--accent)', height:`${Math.max(m.tips/maxRev*100,0)}%` }}/>}
                      {m.services>0 && <div style={{ background:'#22C55E', height:`${Math.max(m.services/maxRev*100,0)}%` }}/>}
                      {m.total===0 && <div style={{ background:'var(--border)', height:4 }}/>}
                    </div>
                    <span style={{ color: chartDetail?.key===m.key?'var(--accent)':'var(--text-sec)', fontSize:9, fontWeight:700 }}>{m.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:10, height:10, borderRadius:2, background:'#22C55E' }}/><span style={{ color:'var(--text-sec)', fontSize:11 }}>Services</span></div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:10, height:10, borderRadius:2, background:'var(--accent)' }}/><span style={{ color:'var(--text-sec)', fontSize:11 }}>Tips</span></div>
              </div>

              {/* Chart detail */}
              {chartDetail && (
                <div style={{ marginTop:12, padding:'12px', background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)' }}>
                  <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13, margin:'0 0 8px' }}>
                    {format(new Date(chartDetail.key+'-01'),'MMMM yyyy')} — {chartDetail.appts.length} appointments
                  </p>
                  <div style={{ display:'flex', gap:12, marginBottom:8 }}>
                    <span style={{ color:'#22C55E', fontWeight:700, fontSize:13 }}>Services {formatCurrency(chartDetail.services)}</span>
                    <span style={{ color:'var(--accent)', fontWeight:700, fontSize:13 }}>Tips {formatCurrency(chartDetail.tips)}</span>
                  </div>
                  {chartDetail.appts.slice(0,4).map((a,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderTop:'1px solid var(--border)' }}>
                      <span style={{ color:'var(--text-sec)', fontSize:12 }}>{a.clientName} · {a.date}</span>
                      <span style={{ color:'var(--text-pri)', fontWeight:700, fontSize:12 }}>{formatCurrency(a.totalWithTip||a.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top services */}
            {topServices.length>0 && (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px' }}>
                <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:12 }}>TOP SERVICES</p>
                {topServices.map(([name,data],i)=>(
                  <div key={name} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <span style={{ color:'var(--text-sec)', fontSize:11, width:14, textAlign:'right', flexShrink:0 }}>{i+1}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ color:'var(--text-pri)', fontSize:13, fontWeight:600 }}>{name}</span>
                        <span style={{ color:'var(--text-sec)', fontSize:12 }}>{data.count}× · {formatCurrency(data.revenue)}</span>
                      </div>
                      <div style={{ height:3, borderRadius:2, background:'var(--border)' }}>
                        <div style={{ height:'100%', borderRadius:2, background:'var(--accent)', width:`${data.count/topServices[0][1].count*100}%` }}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PAYMENTS ── */}
        {view==='payments' && (
          <>
            <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px', marginBottom:12 }}>
              <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:16 }}>PAYMENT METHODS</p>
              {payMethods.length===0 ? (
                <p style={{ color:'var(--text-sec)', fontSize:13, textAlign:'center', padding:'16px 0' }}>No paid appointments yet</p>
              ) : payMethods.map(([pm,data])=>{
                const color = PAY_COLORS[pm]||'#6B7280'
                const pct   = Math.round(data.revenue/maxPayRev*100)
                return (
                  <div key={pm} style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background:color }}/>
                        <span style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, textTransform:'capitalize' }}>{pm}</span>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <span style={{ color:'var(--text-pri)', fontWeight:800, fontSize:14 }}>{formatCurrency(data.revenue)}</span>
                        <span style={{ color:'var(--text-sec)', fontSize:12, marginLeft:6 }}>{data.count} appts</span>
                      </div>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:'var(--border)' }}>
                      <div style={{ height:'100%', borderRadius:3, background:color, width:`${pct}%`, transition:'width 0.4s' }}/>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pie-style breakdown */}
            {payMethods.length>0 && (() => {
              const total = payMethods.reduce((s,[,d])=>s+d.revenue,0)
              return (
                <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px' }}>
                  <p style={{ color:'var(--text-sec)', fontSize:10, fontWeight:700, letterSpacing:'0.09em', marginBottom:12 }}>SHARE OF REVENUE</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {payMethods.map(([pm,data])=>{
                      const color = PAY_COLORS[pm]||'#6B7280'
                      const pct   = Math.round(data.revenue/total*100)
                      return (
                        <div key={pm} style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:8, background:color+'20', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <div style={{ width:12, height:12, borderRadius:'50%', background:color }}/>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <span style={{ color:'var(--text-pri)', fontWeight:600, fontSize:13, textTransform:'capitalize' }}>{pm}</span>
                              <span style={{ color:'var(--text-pri)', fontWeight:700, fontSize:13 }}>{pct}%</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {/* ── HISTORY ── */}
        {view==='history' && (
          <>
            <div style={{ display:'flex', gap:6, marginBottom:14, overflowX:'auto', paddingBottom:2 }}>
              {['All','Completed','Cancelled','Unpaid'].map(f=>(
                <button key={f} onClick={()=>setHistFilter(f)}
                  style={{ flexShrink:0, padding:'7px 14px', borderRadius:20, border:`1.5px solid ${histFilter===f?'var(--accent)':'var(--border)'}`, background:histFilter===f?'var(--accent)':'transparent', color:histFilter===f?'var(--accent-inv)':'var(--text-sec)', fontWeight:700, fontSize:12, cursor:'pointer', ...F }}>
                  {f}
                </button>
              ))}
            </div>
            {historyAppts.length===0 ? (
              <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:32, textAlign:'center' }}>
                <p style={{ color:'var(--text-sec)', margin:0 }}>No appointments</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {historyAppts.map(a=>(
                  <div key={a.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderLeft:`3px solid ${statusColors[a.bookingStatus]||'var(--border)'}`, borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <div>
                        <p style={{ color:'var(--text-pri)', fontWeight:700, fontSize:14, margin:'0 0 2px' }}>{a.clientName}</p>
                        <p style={{ color:'var(--text-sec)', fontSize:12, margin:0 }}>
                          {a.date?format(parseLocalDate(a.date),'MMM d, yyyy'):'—'} · {a.startTime}
                        </p>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p style={{ color:'var(--accent)', fontWeight:800, fontSize:14, margin:'0 0 2px' }}>{formatCurrency(a.totalWithTip||a.totalPrice)}</p>
                        <p style={{ color:statusColors[a.bookingStatus], fontSize:10, fontWeight:700, textTransform:'uppercase', margin:0 }}>{a.bookingStatus}</p>
                      </div>
                    </div>
                    {a.services?.length>0 && (
                      <p style={{ color:'var(--text-sec)', fontSize:12, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {a.services.map(s=>s.name).join(', ')}
                      </p>
                    )}
                    <div style={{ display:'flex', gap:10, marginTop:a.tip>0||a.paymentMethod?6:0 }}>
                      {a.tip>0 && <span style={{ color:'#22C55E', fontSize:11, fontWeight:600 }}>+{formatCurrency(a.tip)} tip</span>}
                      {a.paymentMethod && <span style={{ color:'var(--text-sec)', fontSize:11, textTransform:'capitalize' }}>{a.paymentMethod}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </BarberLayout>
  )
}