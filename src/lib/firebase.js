/**
 * firebase.js — Two isolated Auth instances
 * barberAuth: for /barber/* routes
 * clientAuth: for /b/:slug/* routes
 * Both share the same Firestore & Storage
 */
import { initializeApp } from 'firebase/app'
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

// ── Two separate app instances = truly isolated sessions ──────────────────
const barberApp = initializeApp(config, 'barber')
const clientApp = initializeApp(config, 'client')

// Barber auth — persists in IndexedDB under key 'barber'
export const barberAuth = initializeAuth(barberApp, {
  persistence: indexedDBLocalPersistence,
})

// Client auth — persists in IndexedDB under key 'client'
export const clientAuth = initializeAuth(clientApp, {
  persistence: indexedDBLocalPersistence,
})

// Shared Firestore & Storage (same data, different auth sessions)
export const db             = getFirestore(barberApp)
export const storage        = getStorage(barberApp)
export const googleProvider = new GoogleAuthProvider()

// Legacy export for any file still using `auth` directly
export const auth = clientAuth