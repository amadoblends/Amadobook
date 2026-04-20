import { createContext, useEffect, useState, useRef } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup, signInAnonymously,
  signOut as fbSignOut, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'

export const ClientAuthContext = createContext(null)

export function ClientAuthProvider({ children }) {
  const [user, setUser]         = useState(undefined) // undefined = not yet resolved
  const [userData, setUserData] = useState(null)
  const [loading, setLoading]   = useState(true)
  const resolvedRef = useRef(false)

  async function loadUserData(uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) { setUserData(snap.data()); return snap.data() }
    } catch {}
    return null
  }

  async function signUpClient({ firstName, lastName, email, phone = '', password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: `${firstName} ${lastName}` })
    const data = { firstName, lastName, email, phone, role: 'client', photoURL: '', createdAt: serverTimestamp() }
    await setDoc(doc(db, 'users', cred.user.uid), data)
    setUserData(data)
    return cred.user
  }

  async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    await loadUserData(cred.user.uid)
    return cred.user
  }

  async function signInWithGoogle(role = 'client') {
    const cred = await signInWithPopup(auth, googleProvider)
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
    const cred = await signInAnonymously(auth)
    const data = { firstName, lastName, email, phone, role: 'client', isGuest: true, createdAt: serverTimestamp() }
    await setDoc(doc(db, 'users', cred.user.uid), data, { merge: true })
    setUserData(data)
    return cred.user
  }

  async function signOut() {
    await fbSignOut(auth)
    setUser(null)
    setUserData(null)
  }

  async function resetPassword(email) { return sendPasswordResetEmail(auth, email) }
  async function refreshUserData()    { if (user) await loadUserData(user.uid) }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u)
        await loadUserData(u.uid)
      } else {
        setUser(null)
        setUserData(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  // Never render children until auth is resolved
  if (loading) return null

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