/**
 * useClients — hook Firebase para clientes del barbero
 * Construye la lista de clientes a partir de los appointments (no requiere colección separada)
 *
 * Uso:
 *   const { clients, loading, search, setSearch, sorted } = useClients(barberId)
 */
import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, where,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { formatCurrency } from '../utils/helpers'

// Build a deduplicated client map from appointments array
function buildClientMap(appointments) {
  const map = {}
  appointments.forEach(a => {
    const key = a.clientId || a.clientEmail || a.clientName
    if (!key) return
    if (!map[key]) {
      map[key] = {
        id:         key,
        clientId:   a.clientId   || null,
        name:       a.clientName || 'Unknown',
        email:      a.clientEmail|| '',
        phone:      a.clientPhone|| '',
        photoURL:   a.clientPhotoURL || '',
        isGuest:    a.isGuest    || false,
        visits:     0,
        totalSpent: 0,
        lastDate:   '',
        services:   {},
      }
    }
    const c = map[key]
    c.visits++
    if (a.paymentStatus === 'paid') {
      c.totalSpent += (a.totalWithTip || a.totalPrice || 0)
    }
    if (!c.lastDate || a.date > c.lastDate) {
      c.lastDate = a.date
    }
    a.services?.forEach(s => {
      c.services[s.name] = (c.services[s.name] || 0) + 1
    })
  })
  return Object.values(map)
}

export function useClients(barberId) {
  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [sort,         setSort]         = useState('visits') // 'visits' | 'spent' | 'recent'

  useEffect(() => {
    if (!barberId) return
    const q = query(collection(db,'appointments'), where('barberId','==',barberId))
    const unsub = onSnapshot(q, snap => {
      setAppointments(snap.docs.map(d => ({ id:d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [barberId])

  const allClients = useMemo(() => buildClientMap(appointments), [appointments])

  const filtered = useMemo(() => {
    let list = [...allClients]
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(c =>
        c.name?.toLowerCase().includes(s)  ||
        c.email?.toLowerCase().includes(s) ||
        c.phone?.includes(s)
      )
    }
    if (sort === 'visits') list.sort((a,b) => b.visits - a.visits)
    else if (sort === 'spent') list.sort((a,b) => b.totalSpent - a.totalSpent)
    else list.sort((a,b) => (b.lastDate || '').localeCompare(a.lastDate || ''))
    return list
  }, [allClients, search, sort])

  // Stats
  const stats = useMemo(() => ({
    total:     allClients.length,
    returning: allClients.filter(c => c.visits > 1).length,
    revenue:   allClients.reduce((s,c) => s + c.totalSpent, 0),
    newThisMonth: allClients.filter(c => {
      const month = new Date().toISOString().slice(0,7) // yyyy-MM
      return c.lastDate?.startsWith(month) && c.visits === 1
    }).length,
  }), [allClients])

  // Get all appointments for a specific client key
  function getClientAppointments(clientKey) {
    return appointments.filter(a =>
      a.clientId === clientKey ||
      a.clientEmail === clientKey ||
      a.clientName === clientKey
    ).sort((a,b) => b.date?.localeCompare(a.date) || 0)
  }

  return {
    clients: filtered,
    allClients,
    loading,
    search,
    setSearch,
    sort,
    setSort,
    stats,
    getClientAppointments,
  }
}
