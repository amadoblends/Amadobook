import emailjs from '@emailjs/browser'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const T_CLIENT    = import.meta.env.VITE_EMAILJS_TEMPLATE_CLIENT
const T_BARBER    = import.meta.env.VITE_EMAILJS_TEMPLATE_BARBER
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export async function sendConfirmationEmails({ appointment, barber }) {
  // Only send if EmailJS is configured
  if (!PUBLIC_KEY || PUBLIC_KEY === 'your_public_key') {
    console.log('EmailJS not configured yet — skipping email')
    return
  }

  const params = {
    client_name:    appointment.clientName,
    client_email:   appointment.clientEmail,
    barber_name:    barber.name,
    barber_address: barber.address || '',
    barber_email:   barber.email || '',
    services:       appointment.services.map(s => s.name).join(', '),
    date:           appointment.date,
    time:           appointment.startTime,
    duration:       `${appointment.totalDuration} min`,
    price:          `$${appointment.totalPrice.toFixed(2)}`,
    payment_method: appointment.paymentMethod === 'cash' ? 'Pay at appointment' : 'Paid online',
    booking_id:     appointment.id || '',
  }

  try {
    // Email to client
    if (appointment.clientEmail) {
      await emailjs.send(SERVICE_ID, T_CLIENT, { ...params, to_email: appointment.clientEmail }, PUBLIC_KEY)
    }
    // Email to barber
    await emailjs.send(SERVICE_ID, T_BARBER, { ...params, to_email: barber.email }, PUBLIC_KEY)
  } catch (e) {
    console.error('Email error:', e)
  }
}
