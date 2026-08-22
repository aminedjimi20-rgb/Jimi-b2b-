import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Browser-safe: NEXT_PUBLIC_* Firebase config values are meant to be public
// (they identify the project, they are not secrets). What actually protects
// the bucket is Storage Security Rules (see firebase/storage.rules) — path,
// size and content-type restrictions enforced server-side by Firebase itself.
let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;

export function isFirebaseClientConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
}

export function getFirebaseStorage(): FirebaseStorage | null {
  if (!isFirebaseClientConfigured()) return null;
  if (!storage) {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    app = getApps().length ? getApps()[0] : initializeApp(config);
    storage = getStorage(app);
  }
  return storage;
}
