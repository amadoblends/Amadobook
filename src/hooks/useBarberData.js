/**
 * BarberDataContext
 * ─────────────────
 * Loads barber, appointments, services, availability ONCE.
 * All pages read from this context — zero duplicate Firebase calls.
 * Appointments update in real-time via onSnapshot.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  collection, query, where,
  getDocs, onSnapshot, doc, updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useBarberAuth } from './useBarberAuth'
import { format } from 'date-fns'

const BarberDataContext = createContext(null)

export function BarberDataProvider({ children }) {
  const { user } = useBarberAuth()

  const [barber,       setBarber]       = useState(null)
  const [appointments, setAppointments] = useState([])
  const [services,     setServices]     = useState([])
  const [availability, setAvailability] = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  // ── Load everything once when user is ready ──────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return }

    let unsubAppts = null
    let unsubAvail = null
    let mounted    = true

    async function bootstrap() {
      try {
        // 1. Get barber doc
        const bSnap = await getDocs(
          query(collection(db, 'barbers'), where('userId', '==', user.uid))
        )
        if (!mounted) return
        if (bSnap.empty) { setLoading(false); return }

        const barberDoc = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() }
        setBarber(barberDoc)

        // 2. Load services (one-time, rarely changes)
        const sSnap = await getDocs(
          query(collection(db, 'services'), where('barberId', '==', barberDoc.id))
        )
        if (mounted) {
          setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        }

        // 3. Real-time appointments listener
        unsubAppts = onSnapshot(
          query(collection(db, 'appointments'), where('barberId', '==', barberDoc.id)),
          snap => {
            if (!mounted) return
            setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            setLoading(false)
          },
          err => { if (mounted) { setError(err); setLoading(false) } }
        )

        // 4. Real-time availability listener
        unsubAvail = onSnapshot(
          query(collection(db, 'availability'), where('barberId', '==', barberDoc.id)),
          snap => {
            if (!mounted) return
            if (!snap.empty) setAvailability(snap.docs[0].data())
          }
        )

      } catch (err) {
        if (mounted) { setError(err); setLoading(false) }
      }
    }

    bootstrap()

    return () => {
      mounted = false
      unsubAppts?.()
      unsubAvail?.()
    }
  }, [user?.uid])

  // ── Refresh services (call after add/edit/delete) ─────────────────────────
  const refreshServices = useCallback(async () => {
    if (!barber) return
    const sSnap = await getDocs(
      query(collection(db, 'services'), where('barberId', '==', barber.id))
    )
    setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, [barber])

  // ── Derived data (memoized-style, cheap to compute) ───────────────────────
  const today         = format(new Date(), 'yyyy-MM-dd')
  const activeAppts   = appointments.filter(a => a.bookingStatus !== 'cancelled')
  const todayAppts    = activeAppts.filter(a => a.date === today)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const upcomingAppts = activeAppts.filter(a => a.date > today)
                          .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  const activeServices = services.filter(s => s.isActive !== false)

  const todayEarned    = todayAppts.filter(a => a.paymentStatus === 'paid')
                           .reduce((s, a) => s + (a.totalWithTip || a.totalPrice || 0), 0)
  const todayProjected = todayAppts.filter(a => a.paymentStatus !== 'paid' && a.bookingStatus !== 'cancelled')
                           .reduce((s, a) => s + (a.totalPrice || 0), 0)
  const efficiency     = todayAppts.length > 0
    ? Math.round((todayAppts.filter(a => a.bookingStatus === 'completed').length / todayAppts.length) * 100)
    : 0

  return (
    <BarberDataContext.Provider value={{
      barber, appointments, services, activeServices,
      availability, loading, error,
      // derived
      today, activeAppts, todayAppts, upcomingAppts,
      todayEarned, todayProjected, efficiency,
      // actions
      refreshServices, setBarber, setServices,
    }}>
      {children}
    </BarberDataContext.Provider>
  )
}

export function useBarberData() {
  const ctx = useContext(BarberDataContext)
  if (!ctx) throw new Error('useBarberData must be inside BarberDataProvider')
  return ctx
}