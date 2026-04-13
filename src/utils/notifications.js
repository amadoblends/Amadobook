import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * Create a single notification.
 * Returns true on success, false on failure.
 */
export async function createNotification({ userId, type, title, message, data = {}, important = false }) {
  if (!userId) return false
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      message,
      data,
      important,
      read: false,
      createdAt: serverTimestamp(),
    })
    return true
  } catch (e) {
    console.warn('Notification skipped (permissions):', e.code, userId)
    return false
  }
}

/**
 * Send broadcast notifications to multiple clients.
 * Returns count of successfully created notifications.
 */
export async function createBroadcastNotifications(clientIds, { barberName, subject, message, important = false }) {
  let count = 0
  for (const uid of clientIds) {
    const ok = await createNotification({
      userId:    uid,
      type:      'broadcast',
      title:     `Message from ${barberName}`,
      message:   subject || message,
      data:      { fullMessage: message },
      important,
    })
    if (ok) count++
  }
  return count
}
