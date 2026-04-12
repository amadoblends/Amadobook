import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * Create a notification for a user.
 * type: 'broadcast' | 'reschedule' | 'cancel' | 'booking' | 'system'
 */
export async function createNotification({ userId, type, title, message, data = {} }) {
  if (!userId) return
  try {
    await addDoc(collection(db, 'notifications'), {
      userId, type, title, message, data,
      read: false,
      createdAt: serverTimestamp(),
    })
  } catch (e) { console.error('Notification error:', e) }
}

export async function createBroadcastNotifications(clientIds, { barberName, subject, message }) {
  for (const uid of clientIds) {
    await createNotification({
      userId: uid,
      type: 'broadcast',
      title: `Message from ${barberName}`,
      message: subject || message,
      data: { fullMessage: message },
    })
  }
}
