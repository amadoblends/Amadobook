import { useContext } from 'react'
import { ClientAuthContext } from '../context/ClientAuthContext'
export function useClientAuth() {
  const ctx = useContext(ClientAuthContext)
  if (!ctx) throw new Error('useClientAuth must be inside ClientAuthProvider')
  return ctx
}
