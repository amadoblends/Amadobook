import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { format } from 'date-fns'
import BarberLayout from '../../components/layout/BarberLayout'
import { MessageSquare, Lock } from 'lucide-react'
import { PageLoader } from '../../components/ui/Spinner'

export default function BarberSuggestions() {
  const { user } = useAuth()
  const [barber, setBarber]           = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const bSnap = await getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
        if (bSnap.empty) { setLoading(false); return }
        const b = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
        setBarber(b)
        const fSnap = await getDocs(query(collection(db,'feedback'), where('barberId','==',b.id)))
        const all = fSnap.docs.map(d => ({id:d.id,...d.data()}))
        all.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
        setSuggestions(all)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [user])

  if (loading) return <BarberLayout><PageLoader/></BarberLayout>

  return (
    <BarberLayout>
      <div className="p-4 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold" style={{fontFamily:'Syne,sans-serif',color:'var(--text-pri)'}}>Suggestions</h1>
            <p className="text-xs" style={{color:'var(--text-sec)'}}>Anonymous feedback from clients</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>
            <Lock size={11} style={{color:'var(--text-sec)'}}/>
            <span className="text-xs font-semibold" style={{color:'var(--text-sec)'}}>Anonymous</span>
          </div>
        </div>

        {suggestions.length === 0 ? (
          <div className="card text-center py-12">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" style={{color:'var(--text-sec)'}}/>
            <p className="font-semibold mb-1" style={{color:'var(--text-pri)'}}>No suggestions yet</p>
            <p className="text-sm" style={{color:'var(--text-sec)'}}>They'll appear here when clients send them</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map(s => (
              <div key={s.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'var(--accent)18'}}>
                    <MessageSquare size={15} style={{color:'var(--accent)'}}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed" style={{color:'var(--text-pri)'}}>{s.message}</p>
                    {s.createdAt && (
                      <p className="text-xs mt-2" style={{color:'var(--text-sec)'}}>
                        {format(new Date(s.createdAt.seconds*1000),'MMM d, yyyy · h:mm a')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BarberLayout>
  )
}
