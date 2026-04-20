/**
 * firebase.js — Two isolated Auth instances, ONE shared Firestore/Storage
 *
 * WHY TWO AUTH INSTANCES:
 * Barber and client sessions are completely independent.
 * A barber can be logged in on /barber/* while a client is logged in on /b/:slug/*
 * in the same browser tab, with no interference.
 *
 * WHY ONE FIRESTORE:
 * Firestore is just a database — auth isolation is handled at the rule level.
 * Both apps read/write to the same project data.
 */
import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider,
  indexedDBLocalPersistence, initializeAuth,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const config = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// ── Shared app for Firestore + Storage (no auth needed for reads) ─────────
const sharedApp = getApps().find(a => a.name === 'shared') || initializeApp(config, 'shared')

// ── Barber app — isolated auth session ───────────────────────────────────
const barberApp = getApps().find(a => a.name === 'barber') || initializeApp(config, 'barber')

// ── Client app — isolated auth session ───────────────────────────────────
const clientApp = getApps().find(a => a.name === 'client') || initializeApp(config, 'client')

// Barber auth (persists separately in IndexedDB)
export const barberAuth = initializeAuth(barberApp, {
  persistence: indexedDBLocalPersistence,
})

// Client auth (persists separately in IndexedDB)
export const clientAuth = initializeAuth(clientApp, {
  persistence: indexedDBLocalPersistence,
})

// Shared Firestore & Storage — available to everyone without auth isolation
export const db             = getFirestore(sharedApp)
export const storage        = getStorage(sharedApp)
export const googleProvider = new GoogleAuthProvider()

// Legacy alias — some files still import `auth` directly
export const auth = clientAuth