import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { getDayName } from '../../utils/helpers'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import BarberLayout from '../../components/layout/BarberLayout'
import Modal from '../../components/ui/Modal'
import { Save, Plus, X, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

const DAYS = [0,1,2,3,4,5,6]
const DEFAULT_DAY = { enabled:true, startTime:'09:00', endTime:'18:00', breaks:[] }

const SLOT_PRESETS   = [15, 30, 60]
const BUFFER_PRESETS = [0, 10, 15]
const ADVANCE_PRESETS = [14, 30, 60]
const NOTICE_PRESETS  = [0, 60, 240]

function Chip({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 rounded-2xl text-sm font-semibold transition-all flex-shrink-0"
      style={{
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? 'white' : 'var(--text-sec)',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        minHeight: 42,
      }}>
      {label}
    </button>
  )
}

function CustomInput({ label, value, onChange, suffix, min = 0 }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-sec)' }}>{label}</p>
      <div className="flex items-center gap-2 rounded-2xl px-4" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', minHeight: 48 }}>
        <input
          type="number" inputMode="numeric" min={min} value={value}
          onChange={e => onChange(Math.max(min, +e.target.value))}
          style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-pri)', fontSize: 16, width: '100%', fontWeight: 600 }}/>
        {suffix && <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-sec)' }}>{suffix}</span>}
      </div>
    </div>
  )
}

export default function BarberAvailability() {
  const { user } = useAuth()
  const [barber, setBarber]     = useState(null)
  const [availId, setAvailId]   = useState(null)
  const [schedule, setSchedule] = useState(() =>
    Object.fromEntries(DAYS.map(d => [d, d===0 ? {...DEFAULT_DAY,enabled:false} : {...DEFAULT_DAY}]))
  )
  const [blockedDates, setBlockedDates] = useState([])
  const [slotDuration, setSlotDuration] = useState(15)
  const [bufferTime, setBufferTime]     = useState(0)
  const [advanceDays, setAdvanceDays]   = useState(30)
  const [minNotice, setMinNotice]       = useState(60)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [blockModal, setBlockModal]     = useState(false)
  const [newBlock, setNewBlock]         = useState({ date: format(new Date(), 'yyyy-MM-dd') })
  const [expanded, setExpanded]         = useState(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const bSnap = await getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
        if (bSnap.empty) { setLoading(false); return }
        const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
        setBarber(b)
        const aSnap = await getDocs(query(collection(db,'availability'), where('barberId','==',b.id)))
        if (!aSnap.empty) {
          const data = aSnap.docs[0].data()
          setAvailId(aSnap.docs[0].id)
          setBlockedDates(data.blockedDates || [])
          setSlotDuration(data.slotDuration || 15)
          setBufferTime(data.bufferTime || 0)
          setAdvanceDays(data.advanceDays || 30)
          setMinNotice(data.minNotice || 60)
          if (data.schedule) {
            setSchedule(data.schedule)
          } else {
            const s = {}
            DAYS.forEach(d => {
              s[d] = {
                enabled: (data.workingDays||[1,2,3,4,5,6]).includes(d),
                startTime: data.startTime || '09:00',
                endTime: data.endTime || '18:00',
                breaks: data.breaks || [],
              }
            })
            setSchedule(s)
          }
        }
      } catch (e) { console.error(e); toast.error('Could not load') }
      finally { setLoading(false) }
    }
    load()
  }, [user])

  function updateDay(d, field, val) { setSchedule(p => ({...p,[d]:{...p[d],[field]:val}})) }
  function addBreak(d) { setSchedule(p => ({...p,[d]:{...p[d],breaks:[...(p[d].breaks||[]),{startTime:'12:00',endTime:'13:00'}]}})) }
  function removeBreak(d,i) { setSchedule(p => ({...p,[d]:{...p[d],breaks:p[d].breaks.filter((_,idx)=>idx!==i)}})) }
  function updateBreak(d,i,field,val) { setSchedule(p => ({...p,[d]:{...p[d],breaks:p[d].breaks.map((b,idx)=>idx===i?{...b,[field]:val}:b)}})) }

  async function handleSave() {
    if (!barber) return
    setSaving(true)
    try {
      const payload = {
        barberId: barber.id, schedule, blockedDates,
        slotDuration, bufferTime, advanceDays, minNotice,
        workingDays: DAYS.filter(d => schedule[d]?.enabled),
        startTime: schedule[1]?.startTime || '09:00',
        endTime: schedule[1]?.endTime || '18:00',
        breaks: schedule[1]?.breaks || [],
        updatedAt: serverTimestamp(),
      }
      if (availId) {
        await updateDoc(doc(db,'availability',availId), payload)
      } else {
        const ref = doc(collection(db,'availability'))
        await setDoc(ref, payload)
        setAvailId(ref.id)
      }
      toast.success('Schedule saved!')
      setSettingsOpen(false)
    } catch (e) { console.error(e); toast.error('Could not save') }
    finally { setSaving(false) }
  }

  function addBlockedDate() {
    if (!newBlock.date) return toast.error('Select a date')
    if (blockedDates.includes(newBlock.date)) return toast.error('Already blocked')
    setBlockedDates(p => [...p, newBlock.date].sort())
    setBlockModal(false)
  }

  if (loading) return <BarberLayout><PageLoader /></BarberLayout>

  const formatNotice = n => n===0 ? 'None' : n < 60 ? `${n} min` : `${n/60}h`
  const formatBuffer = n => n===0 ? 'None' : `${n} min`

  return (
    <BarberLayout>
      <div className="p-4 max-w-xl mx-auto w-full overflow-x-hidden pb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold" style={{fontFamily:"'Space Grotesk','Monda',sans-serif",color:'var(--text-pri)'}}>Availability</h1>
            <p className="text-xs" style={{color:'var(--text-sec)'}}>Set your hours per day</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl font-semibold text-sm"
              style={{background:'var(--surface)',color:'var(--text-sec)',border:'1.5px solid var(--border)',minHeight:40}}>
              <Settings2 size={15}/> Rules
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary gap-2 px-4" style={{minHeight:40,fontSize:14}}>
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Save size={15}/>}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Booking rules summary pills */}
        <div className="flex gap-2 flex-wrap mb-5">
          {[
            { label: `Slots every ${slotDuration}m` },
            { label: bufferTime===0 ? 'No buffer' : `${bufferTime}m buffer` },
            { label: `${advanceDays}d ahead` },
            { label: minNotice===0 ? 'Any time' : `${formatNotice(minNotice)} notice` },
          ].map((p,i) => (
            <button key={i} onClick={() => setSettingsOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{background:'var(--accent)15',color:'var(--accent)',border:'1px solid var(--accent)33'}}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Per-day schedule */}
        <div className="space-y-2 mb-4">
          {DAYS.map(d => {
            const day = schedule[d] || DEFAULT_DAY
            const isExp = expanded === d
            return (
              <div key={d} className="card" style={{border:`1px solid ${day.enabled?'var(--accent)44':'var(--border)'}`}}>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateDay(d,'enabled',!day.enabled)}
                    className="relative w-11 h-6 rounded-full flex-shrink-0 transition-all"
                    style={{background: day.enabled ? 'var(--accent)' : 'var(--border)'}}>
                    <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                      style={{left: day.enabled ? '22px' : '2px'}}/>
                  </button>
                  <p className="font-bold text-sm flex-1" style={{color: day.enabled ? 'var(--text-pri)' : 'var(--text-sec)'}}>
                    {getDayName(d)}
                  </p>
                  {day.enabled ? (
                    <>
                      <span className="text-xs" style={{color:'var(--text-sec)'}}>{day.startTime}–{day.endTime}</span>
                      <button onClick={() => setExpanded(isExp ? null : d)} className="p-1 flex-shrink-0" style={{color:'var(--text-sec)'}}>
                        {isExp ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs" style={{color:'var(--text-sec)'}}>Closed</span>
                  )}
                </div>

                {day.enabled && isExp && (
                  <div className="mt-3 pt-3" style={{borderTop:'1px solid var(--border)'}}>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{color:'var(--text-sec)'}}>Opens</p>
                        <div className="rounded-2xl flex items-center px-4" style={{background:'var(--surface)',border:'1.5px solid var(--border)',minHeight:52}}>
                          <input type="time" value={day.startTime}
                            onChange={e => updateDay(d,'startTime',e.target.value)}
                            style={{background:'transparent',border:'none',outline:'none',color:'var(--text-pri)',fontSize:16,fontWeight:600,width:'100%',colorScheme:'dark'}}/>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{color:'var(--text-sec)'}}>Closes</p>
                        <div className="rounded-2xl flex items-center px-4" style={{background:'var(--surface)',border:'1.5px solid var(--border)',minHeight:52}}>
                          <input type="time" value={day.endTime}
                            onChange={e => updateDay(d,'endTime',e.target.value)}
                            style={{background:'transparent',border:'none',outline:'none',color:'var(--text-pri)',fontSize:16,fontWeight:600,width:'100%',colorScheme:'dark'}}/>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{color:'var(--text-sec)'}}>Breaks</p>
                      <button onClick={() => addBreak(d)} className="text-xs font-bold flex items-center gap-1" style={{color:'var(--accent)'}}>
                        <Plus size={12}/> Add
                      </button>
                    </div>
                    {(day.breaks||[]).length===0 && <p className="text-xs mb-1" style={{color:'var(--text-sec)'}}>No breaks</p>}
                    {(day.breaks||[]).map((b,i) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <div className="flex-1 rounded-2xl flex items-center px-3" style={{background:'var(--surface)',border:'1.5px solid var(--border)',minHeight:48}}>
                          <input type="time" value={b.startTime}
                            onChange={e => updateBreak(d,i,'startTime',e.target.value)}
                            style={{background:'transparent',border:'none',outline:'none',color:'var(--text-pri)',fontSize:15,fontWeight:600,width:'100%',colorScheme:'dark'}}/>
                        </div>
                        <span style={{color:'var(--text-sec)',flexShrink:0}}>–</span>
                        <div className="flex-1 rounded-2xl flex items-center px-3" style={{background:'var(--surface)',border:'1.5px solid var(--border)',minHeight:48}}>
                          <input type="time" value={b.endTime}
                            onChange={e => updateBreak(d,i,'endTime',e.target.value)}
                            style={{background:'transparent',border:'none',outline:'none',color:'var(--text-pri)',fontSize:15,fontWeight:600,width:'100%',colorScheme:'dark'}}/>
                        </div>
                        <button onClick={() => removeBreak(d,i)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{background:'#ef444415',color:'#f87171'}}>
                          <X size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Blocked dates */}
        <div className="card mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm" style={{color:'var(--text-pri)'}}>Blocked Dates</p>
            <button onClick={() => setBlockModal(true)} className="text-xs font-bold flex items-center gap-1" style={{color:'var(--accent)'}}>
              <Plus size={12}/> Block Day
            </button>
          </div>
          {blockedDates.length===0 ? (
            <p className="text-sm" style={{color:'var(--text-sec)'}}>No blocked dates</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {blockedDates.map(date => (
                <div key={date} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                  style={{background:'#ef444415',border:'1px solid #ef444433'}}>
                  <span className="text-sm font-semibold" style={{color:'#f87171'}}>
                    {format(new Date(date+'T12:00'),'MMM d')}
                  </span>
                  <button onClick={() => setBlockedDates(p => p.filter(dd=>dd!==date))} style={{color:'#f87171'}}>
                    <X size={12}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── SETTINGS MODAL ── */}
      <Modal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} title="Booking Rules" size="md">
        <div className="space-y-6">

          {/* Slot interval */}
          <div>
            <p className="font-bold text-sm mb-1" style={{color:'var(--text-pri)'}}>Time slot interval</p>
            <p className="text-xs mb-3" style={{color:'var(--text-sec)'}}>How often booking slots appear (e.g. every 15 min)</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {SLOT_PRESETS.map(v => <Chip key={v} active={slotDuration===v} onClick={() => setSlotDuration(v)} label={`${v} min`}/>)}
              {!SLOT_PRESETS.includes(slotDuration) && <Chip active label={`${slotDuration} min ✓`} onClick={() => {}}/>}
            </div>
            <CustomInput label="Custom" value={slotDuration} onChange={setSlotDuration} suffix="min" min={5}/>
          </div>

          {/* Buffer */}
          <div>
            <p className="font-bold text-sm mb-1" style={{color:'var(--text-pri)'}}>Buffer between appointments</p>
            <p className="text-xs mb-3" style={{color:'var(--text-sec)'}}>Extra time after each appointment (for cleanup, break, etc.)</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {BUFFER_PRESETS.map(v => <Chip key={v} active={bufferTime===v} onClick={() => setBufferTime(v)} label={v===0?'None':`${v} min`}/>)}
              {!BUFFER_PRESETS.includes(bufferTime) && <Chip active label={`${bufferTime} min ✓`} onClick={() => {}}/>}
            </div>
            <CustomInput label="Custom" value={bufferTime} onChange={setBufferTime} suffix="min" min={0}/>
          </div>

          {/* Advance days */}
          <div>
            <p className="font-bold text-sm mb-1" style={{color:'var(--text-pri)'}}>Booking window</p>
            <p className="text-xs mb-3" style={{color:'var(--text-sec)'}}>How many days in advance clients can book. Days beyond this are shown as unavailable.</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {ADVANCE_PRESETS.map(v => <Chip key={v} active={advanceDays===v} onClick={() => setAdvanceDays(v)} label={`${v} days`}/>)}
              {!ADVANCE_PRESETS.includes(advanceDays) && <Chip active label={`${advanceDays} days ✓`} onClick={() => {}}/>}
            </div>
            <CustomInput label="Custom" value={advanceDays} onChange={setAdvanceDays} suffix="days" min={1}/>
            <p className="text-xs mt-2 font-semibold" style={{color:'var(--accent)'}}>
              Clients can book from today up to {advanceDays} days ahead
            </p>
          </div>

          {/* Min notice */}
          <div>
            <p className="font-bold text-sm mb-1" style={{color:'var(--text-pri)'}}>Minimum notice</p>
            <p className="text-xs mb-3" style={{color:'var(--text-sec)'}}>Minimum time before an appointment that clients can still book</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {NOTICE_PRESETS.map(v => <Chip key={v} active={minNotice===v} onClick={() => setMinNotice(v)} label={v===0?'None':formatNotice(v)}/>)}
              {!NOTICE_PRESETS.includes(minNotice) && <Chip active label={`${formatNotice(minNotice)} ✓`} onClick={() => {}}/>}
            </div>
            <CustomInput label="Custom" value={minNotice} onChange={setMinNotice} suffix="min" min={0}/>
            <p className="text-xs mt-2 font-semibold" style={{color:'var(--accent)'}}>
              {minNotice===0 ? 'Clients can book last minute' : `Clients must book at least ${formatNotice(minNotice)} before`}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setSettingsOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              {saving ? 'Saving...' : 'Save Rules'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Block date modal */}
      <Modal isOpen={blockModal} onClose={() => setBlockModal(false)} title="Block a Day">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:'var(--text-sec)'}}>Date</p>
            <input type="date" value={newBlock.date}
              min={format(new Date(),'yyyy-MM-dd')}
              onChange={e => setNewBlock(p => ({...p,date:e.target.value}))}
              className="input" style={{fontSize:16,colorScheme:'dark'}}/>
            {newBlock.date && (
              <p className="text-xs mt-1.5 font-semibold" style={{color:'var(--accent)'}}>
                {format(new Date(newBlock.date+'T12:00'),'EEEE, MMMM d, yyyy')}
              </p>
            )}
          </div>
          <p className="text-xs" style={{color:'var(--text-sec)'}}>Clients won't be able to book on this day.</p>
          <div className="flex gap-3">
            <button onClick={() => setBlockModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={addBlockedDate} className="btn-primary flex-1">Block Day</button>
          </div>
        </div>
      </Modal>
    </BarberLayout>
  )
}
