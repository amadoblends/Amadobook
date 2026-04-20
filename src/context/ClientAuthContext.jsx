/**
 * ClientAuthContext — Isolated client session
 * Uses clientAuth (separate Firebase app instance)
 * Completely independent from barber session
 */
import { createContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup, signInAnonymously,
  signOut as fbSignOut, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { clientAuth, db, googleProvider } from '../lib/firebase'

export const ClientAuthContext = createContext(null)

export function ClientAuthProvider({ children }) {
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

  async function signUpClient({ firstName, lastName, email, phone = '', password }) {
    const cred = await createUserWithEmailAndPassword(clientAuth, email, password)
    await updateProfile(cred.user, { displayName: `${firstName} ${lastName}` })
    const data = { firstName, lastName, email, phone, role: 'client', photoURL: '', createdAt: serverTimestamp() }
    await setDoc(doc(db, 'users', cred.user.uid), data)
    setUserData(data)
    return cred.user
  }

  async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(clientAuth, email, password)
    await loadUserData(cred.user.uid)
    return cred.user
  }

  async function signInWithGoogle(role = 'client') {
    const cred = await signInWithPopup(clientAuth, googleProvider)
    const snap = await getDoc(doc(db, 'users', cred.user.uid))
    if (!snap.exists()) {
      const [firstName, ...rest] = (cred.user.displayName || 'Client').split(' ')
      const data = { firstName, lastName: rest.join(' ') || '', email: cred.user.email, phone: '', role, photoURL: cred.user.photoURL || '', createdAt: serverTimestamp() }
      await setDoc(doc(db, 'users', cred.user.uid), data)
      setUserData(data)
    } else {
      setUserData(snap.data())
    }
    return cred.user
  }

  async function continueAsGuest({ firstName, lastName, email = '', phone = '' }) {
    const cred = await signInAnonymously(clientAuth)
    const data = { firstName, lastName, email, phone, role: 'client', isGuest: true, createdAt: serverTimestamp() }
    await setDoc(doc(db, 'users', cred.user.uid), data, { merge: true })
    setUserData(data)
    return cred.user
  }

  async function signOut() {
    await fbSignOut(clientAuth)
    setUser(null); setUserData(null)
  }

  async function resetPassword(email) { return sendPasswordResetEmail(clientAuth, email) }
  async function refreshUserData()    { if (user) await loadUserData(user.uid) }

  useEffect(() => {
    // Small delay prevents false "logged out" state during app init
    let mounted = true
    const unsub = onAuthStateChanged(clientAuth, async (u) => {
      if (!mounted) return
      if (u) {
        setUser(u)
        await loadUserData(u.uid)
      } else {
        setUser(null)
        setUserData(null)
      }
      if (mounted) setLoading(false)
    })
    return () => { mounted = false; unsub() }
  }, [])

  return (
    <ClientAuthContext.Provider value={{
      user, userData, loading,
      signUpClient, signIn, signInWithGoogle, continueAsGuest,
      signOut, resetPassword, refreshUserData,
    }}>
      {children}
    </ClientAuthContext.Provider>
  )
}