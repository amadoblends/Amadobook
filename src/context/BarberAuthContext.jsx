import { createContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup,
  signOut as fbSignOut, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'

export const BarberAuthContext = createContext(null)

export function BarberAuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading]   = useState(true)

  async function loadUserData(uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) { setUserData(snap.data()); return snap.data() }
    } catch {}
    return null
  }

  async function signUpBarber({ firstName, lastName, email, phone, password, code }) {
    const validCode = import.meta.env.VITE_BARBER_CODE || 'AMADO2026'
    if (code.trim().toUpperCase() !== validCode.toUpperCase())
      throw new Error('Invalid access code.')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: `${firstName} ${lastName}` })
    const data = { firstName, lastName, email, phone, role: 'barber', photoURL: '', createdAt: serverTimestamp() }
    await setDoc(doc(db, 'users', cred.user.uid), data)
    setUserData(data)
    return cred.user
  }

  async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const data = await loadUserData(cred.user.uid)
    if (data?.role !== 'barber') {
      await fbSignOut(auth)
      throw new Error('Not a barber account.')
    }
    return cred.user
  }

  async function signInWithGoogle() {
    const cred = await signInWithPopup(auth, googleProvider)
    const snap = await getDoc(doc(db, 'users', cred.user.uid))
    if (!snap.exists()) {
      const [firstName, ...rest] = (cred.user.displayName || 'Barber').split(' ')
      const data = { firstName, lastName: rest.join(' ') || '', email: cred.user.email, phone: '', role: 'barber', photoURL: cred.user.photoURL || '', createdAt: serverTimestamp() }
      await setDoc(doc(db, 'users', cred.user.uid), data)
      setUserData(data)
    } else {
      setUserData(snap.data())
    }
    return cred.user
  }

  async function signOut()         { await fbSignOut(auth); setUser(null); setUserData(null) }
  async function resetPassword(e)  { return sendPasswordResetEmail(auth, e) }
  async function refreshUserData() { if (user) await loadUserData(user.uid) }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) { setUser(u); await loadUserData(u.uid) }
      else   { setUser(null); setUserData(null) }
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <BarberAuthContext.Provider value={{
      user, userData, loading,
      signUpBarber, signIn, signInWithGoogle,
      signOut, resetPassword, refreshUserData,
    }}>
      {children}
    </BarberAuthContext.Provider>
  )
}