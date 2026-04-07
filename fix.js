// ============================================
// AmadoBook — COMPLETE FIX SCRIPT
// Corre con: node fix.js
// ============================================

import { initializeApp } from "firebase/app"
import {
  getFirestore, doc, setDoc, addDoc, getDocs,
  collection, query, where, deleteDoc, serverTimestamp
} from "firebase/firestore"

const firebaseConfig = {
  apiKey:            "AIzaSyBiclg_JO28E1xjMl0ZJsvtvOSU4sjJwPE",
  authDomain:        "amadobookpro.firebaseapp.com",
  projectId:         "amadobookpro",
  storageBucket:     "amadobookpro.firebasestorage.app",
  messagingSenderId: "364305574802",
  appId:             "1:364305574802:web:20797cc1151241efff6f4b"
}

// ✅ PEGA TU USER ID AQUÍ
// Lo encuentras en: Firebase Console → Authentication → Users → columna "User UID"
const USER_ID = "rJdw3Yg2qLX08zYNAW5ovm9chic2"

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

async function fix() {
const USER_ID = "rJdw3Yg2qLX08zYNAW5ovm9chic2"

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

async function fix() {
  console.log("\n💈 AmadoBook — Complete Fix\n")
  }

  console.log("\n💈 AmadoBook — Complete Fix\n")
  console.log(`   User ID: ${USER_ID}\n`)

  // 1. Fix user role
  console.log("1️⃣  Setting user role to barber...")
  await setDoc(doc(db, "users", USER_ID), {
    role:      "barber",
    firstName: "Angelo",
    lastName:  "Ferreras",
    phone:     "9176128231",
    email:     "amadoblends@gmail.com",
    photoURL:  "",
  }, { merge: true })
  console.log("   ✅ role = barber")

  // 2. Create/update barber profile
  console.log("\n2️⃣  Creating barber profile...")
  await setDoc(doc(db, "barbers", USER_ID), {
    userId:    USER_ID,
    name:      "AmadoBlends",
    slug:      "amadoblends",
    bio:       "Professional barber in Utica, NY. Specializing in fades, lineups, and beard trims.",
    address:   "647 Bleecker St, Utica, NY",
    phone:     "(315) 555-0100",
    email:     "amadoblends@gmail.com",
    photoURL:  "",
    isActive:  true,
    createdAt: serverTimestamp(),
  })
  console.log("   ✅ Barber: AmadoBlends — slug: amadoblends")

  // 3. Create/update availability
  console.log("\n3️⃣  Setting up availability...")
  await setDoc(doc(db, "availability", USER_ID), {
    barberId:     USER_ID,
    workingDays:  [1, 2, 3, 4, 5, 6],
    startTime:    "09:00",
    endTime:      "18:00",
    slotDuration: 15,
    breaks:       [{ startTime: "12:00", endTime: "13:00" }],
    blockedDates: [],
  })
  console.log("   ✅ Mon–Sat, 9am–6pm, lunch break 12–1pm")

  // 4. Delete ALL old services (wrong barberId)
  console.log("\n4️⃣  Cleaning up old services...")
  const allServices = await getDocs(collection(db, "services"))
  let deleted = 0
  for (const d of allServices.docs) {
    await deleteDoc(d.ref)
    deleted++
  }
  console.log(`   ✅ Deleted ${deleted} old services`)

  // 5. Create fresh services with correct barberId
  console.log("\n5️⃣  Adding services with correct barberId...")
  const services = [
    // COMBOS
    { name: "Fade + Beard Trim",       description: "Full fade with shape-up and beard trim", price: 45, duration: 60, serviceType: "combo",  isActive: true },
    { name: "Cut + Shampoo + Style",   description: "Haircut, wash, and professional styling",  price: 55, duration: 75, serviceType: "combo",  isActive: true },
    // SINGLES
    { name: "Fade",                    description: "Clean skin fade or low/mid/high fade",      price: 30, duration: 35, serviceType: "single", isActive: true },
    { name: "Haircut",                 description: "Scissor cut or clipper cut",                price: 25, duration: 30, serviceType: "single", isActive: true },
    { name: "Beard Trim",              description: "Shape and trim with straight razor finish",  price: 20, duration: 20, serviceType: "single", isActive: true },
    { name: "Lineup / Edge Up",        description: "Clean lines on hairline and neckline",      price: 15, duration: 15, serviceType: "single", isActive: true },
    { name: "Kids Cut (under 12)",     description: "Haircut for children 12 and under",         price: 20, duration: 25, serviceType: "single", isActive: true },
    // EXTRAS
    { name: "Hot Towel Treatment",     description: "Relaxing hot towel for face and scalp",     price: 8,  duration: 10, serviceType: "extra",  isActive: true },
    { name: "Scalp Massage",           description: "5-min scalp massage with essential oils",   price: 10, duration: 10, serviceType: "extra",  isActive: true },
    { name: "Hair Design",             description: "Custom design or pattern cut into hair",    price: 15, duration: 15, serviceType: "extra",  isActive: true },
  ]

  for (const svc of services) {
    await addDoc(collection(db, "services"), {
      ...svc,
      barberId:  USER_ID,
      createdAt: serverTimestamp(),
    })
    console.log(`   ✅ [${svc.serviceType.padEnd(6)}] ${svc.name} — $${svc.price}`)
  }

  console.log("\n🎉 Everything fixed!\n")
  console.log("📋 Next steps:")
  console.log("   1. Go to Firestore → Rules → publish the secure rules")
  console.log("   2. Create the 4 indexes (see instructions below)")
  console.log("   3. Reload the app\n")
  console.log("🔗 Your links:")
  console.log("   Barber dashboard: http://localhost:5174/barber/dashboard")
  console.log("   Client booking:   http://localhost:5174/b/amadoblends\n")

  console.log("📊 INDEXES TO CREATE:")
  console.log("   Go to: https://console.firebase.google.com/project/amadobookpro/firestore/indexes")
  console.log("")
  console.log("   Index 1: appointments | barberId ASC + date ASC")
  console.log("   Index 2: appointments | barberId ASC + createdAt DESC")
  console.log("   Index 3: appointments | clientId ASC + createdAt DESC")
  console.log("   Index 4: feedback     | barberId ASC + createdAt DESC")

  process.exit(0)
}

fix().catch(err => {
  console.error("\n❌ Error:", err.message)
  console.error("   Make sure Firestore rules are set to: allow read, write: if true;")
  process.exit(1)
})
