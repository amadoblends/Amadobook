import { useContext } from 'react'
import { BarberAuthContext } from '../context/BarberAuthContext'
export function useBarberAuth() {
  const ctx = useContext(BarberAuthContext)
  if (!ctx) throw new Error('useBarberAuth must be inside BarberAuthProvider')
  return ctx
}