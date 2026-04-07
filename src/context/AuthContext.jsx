import { createContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup,
  signOut as fbSignOut, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading]   = useState(true)

  async function loadUserData(uid) {
    const snap = await getDoc(doc(db,'users',uid))
    if (snap.exists()) { setUserData(snap.data()); return snap.data() }
    return null
  }

  async function signUpBarber({ firstName, lastName, email, phone, password, code }) {
    const validCode = import.meta.env.VITE_BARBER_CODE || 'AMADO2026'
    if (code.trim().toUpperCase() !== validCode.toUpperCase())
      throw new Error('Invalid access code. Contact AmadoBook to get yours.')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName:`${firstName} ${lastName}` })
    const data = { firstName, lastName, email, phone, role:'barber', photoURL:'', createdAt:serverTimestamp() }
    await setDoc(doc(db,'users',cred.user.uid), data)
    setUserData(data)
    return cred.user
  }

  async function signUpClient({ firstName, lastName, email, phone, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName:`${firstName} ${lastName}` })
    const data = { firstName, lastName, email, phone, role:'client', photoURL:'', createdAt:serverTimestamp() }
    await setDoc(doc(db,'users',cred.user.uid), data)
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
    const snap = await getDoc(doc(db,'users',cred.user.uid))
    if (!snap.exists()) {
      const [firstName,...rest] = (cred.user.displayName||'User').split(' ')
      const data = { firstName, lastName:rest.join(' ')||'', email:cred.user.email, phone:'', role, photoURL:cred.user.photoURL||'', createdAt:serverTimestamp() }
      await setDoc(doc(db,'users',cred.user.uid), data)
      setUserData(data)
    } else { setUserData(snap.data()) }
    return cred.user
  }

  async function signOut() {
    await fbSignOut(auth)
    setUser(null); setUserData(null)
  }

  async function resetPassword(email) { return sendPasswordResetEmail(auth, email) }
  async function refreshUserData() { if (user) await loadUserData(user.uid) }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      setUser(u)
      if (u) await loadUserData(u.uid)
      else setUserData(null)
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{ user, userData, loading, signUpBarber, signUpClient, signIn, signInWithGoogle, signOut, resetPassword, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  )
}
