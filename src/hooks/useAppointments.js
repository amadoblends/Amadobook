/**
 * useAppointments — hook Firebase para citas del barbero
 *
 * Uso en cualquier página del barber:
 *   const { appointments, loading, todayAppts, upcoming, barberId } = useAppointments()
 */
import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, where,
  onSnapshot, getDocs, doc, updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useBarberAuth as useAuth } from './useBarberAuth'
import { format } from 'date-fns'
import { todayStr, isAppointmentPast } from '../utils/helpers'

export function useAppointments() {
  const { user } = useAuth()
  const [barberId,    setBarberId]    = useState(null)
  const [appointments,setAppointments]= useState([])
  const [loading,     setLoading]     = useState(true)

  // 1. Get barberId from barbers collection
  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db,'barbers'), where('userId','==',user.uid)))
      .then(snap => {
        if (!snap.empty) setBarberId(snap.docs[0].id)
        else setLoading(false)
      })
  }, [user])

  // 2. Listen to all appointments for this barber
  useEffect(() => {
    if (!barberId) return
    const q = query(collection(db,'appointments'), where('barberId','==',barberId))
    const unsub = onSnapshot(q, snap => {
      setAppointments(snap.docs.map(d => ({ id:d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [barberId])

  // 3. Auto-complete past confirmed appointments
  useEffect(() => {
    if (!appointments.length) return
    const now    = new Date()
    const toMark = appointments.filter(a => {
      if (a.bookingStatus !== 'confirmed' && a.bookingStatus !== 'pending') return false
      return isAppointmentPast(a.date, a.endTime)
    })
    toMark.forEach(a => {
      updateDoc(doc(db,'appointments',a.id), { bookingStatus:'completed' }).catch(() => {})
    })
  }, [appointments])

  // 4. Derived lists
  const today = todayStr()

  const todayAppts = useMemo(() =>
    appointments
      .filter(a => a.date === today && a.bookingStatus !== 'cancelled')
      .sort((a,b) => a.startTime.localeCompare(b.startTime)),
  [appointments, today])

  const upcoming = useMemo(() =>
    appointments
      .filter(a => a.date > today && a.bookingStatus !== 'cancelled' && a.bookingStatus !== 'completed')
      .sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
  [appointments, today])

  const past = useMemo(() =>
    appointments
      .filter(a => a.bookingStatus === 'completed' || (a.date < today && a.bookingStatus !== 'cancelled'))
      .sort((a,b) => b.date.localeCompare(a.date)),
  [appointments, today])

  const cancelled = useMemo(() =>
    appointments
      .filter(a => a.bookingStatus === 'cancelled')
      .sort((a,b) => b.date.localeCompare(a.date)),
  [appointments])

  // Today's earnings
  const todayEarned = useMemo(() =>
    todayAppts
      .filter(a => a.paymentStatus === 'paid')
      .reduce((s,a) => s + (a.totalWithTip || a.totalPrice || 0), 0),
  [todayAppts])

  const todayProjected = useMemo(() =>
    todayAppts
      .filter(a => a.paymentStatus !== 'paid' && a.bookingStatus !== 'cancelled')
      .reduce((s,a) => s + (a.totalPrice || 0), 0),
  [todayAppts])

  const efficiency = useMemo(() => {
    if (!todayAppts.length) return 0
    return Math.round((todayAppts.filter(a => a.bookingStatus === 'completed').length / todayAppts.length) * 100)
  }, [todayAppts])

  // Cancel an appointment
  async function cancelAppointment(id, reason = '') {
    await updateDoc(doc(db,'appointments',id), {
      bookingStatus: 'cancelled',
      cancelReason:  reason,
    })
  }

  // Mark as completed + paid
  async function completeAppointment(id, tip = 0, paymentMethod = 'cash') {
    const appt = appointments.find(a => a.id === id)
    if (!appt) return
    await updateDoc(doc(db,'appointments',id), {
      bookingStatus:  'completed',
      paymentStatus:  'paid',
      tip,
      totalWithTip:   (appt.totalPrice || 0) + tip,
      paymentMethod,
    })
  }

  return {
    appointments,
    loading,
    barberId,
    todayAppts,
    upcoming,
    past,
    cancelled,
    todayEarned,
    todayProjected,
    efficiency,
    cancelAppointment,
    completeAppointment,
  }
}
