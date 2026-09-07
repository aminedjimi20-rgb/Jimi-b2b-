import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Server-only: uses a service account with full access to Firestore,
// bypassing security rules entirely. Firestore rules (see
// firebase/firestore.rules) deny all direct client access — every read/write
// of seller/buyer/machine data goes through this admin client inside our own
// API routes, never from the browser. Never import this file from a
// "use client" component.
let app: App | null = null;
let db: Firestore | null = null;

// Vercel's env var UI (especially pasted from a mobile browser) can mangle a
// multi-line PEM key: wrapping quotes get typed in literally, real newlines
// get flattened, or escaped "\n" sequences stay escaped. Normalize all of
// that instead of demanding one exact paste format.
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
  return key;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  );
}

export function getFirestoreAdmin(): Firestore {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (see .env.example)."
    );
  }
  if (!db) {
    if (!getApps().length) {
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY!),
        }),
      });
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
  }
  return db;
}
