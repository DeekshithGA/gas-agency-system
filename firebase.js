import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, multiFactor } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getMessaging } from "firebase/messaging";
import { getRemoteConfig } from "firebase/remote-config";
import { getPerformance } from "firebase/performance";
import { getAnalytics, logEvent } from "firebase/analytics";

// Config object
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
};

// App initialization
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export const messaging = getMessaging(app);
export const remoteConfig = getRemoteConfig(app);
export const performance = getPerformance(app);
export const analytics = getAnalytics(app);

// Enable Firestore offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  console.log("Firestore offline persistence error:", err.code);
});

// For local development (uncomment if needed)
// connectFirestoreEmulator(db, "localhost", 8080);

// Utility: Auth state monitor and multi-factor
export const monitorAuth = (callback) => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Multi-factor status
      const mfaInfo = multiFactor(user);
      logEvent(analytics, "auth_state_changed", { uid: user.uid, mfaEnrolled: mfaInfo.enrolledFactors.length });
    }
    callback(user);
  });
};

// Utility: Set and get custom claims (requires Admin SDK on backend)
// Frontend example to refresh token after backend sets claims
export const refreshCustomClaims = (user) => {
  // Listen for metadata changes (claims update)
  const metadataRef = rtdb.ref('metadata/' + user.uid + '/refreshTime');
  metadataRef.on('value', snapshot => {
    user.getIdToken(true);
  });
};

// Utility: Rate limiting (requires corresponding backend rules/session tracking)
export const canProceedByRateLimit = async (actionKey, msThreshold = 5000) => {
  // Example: store last action timestamp in localStorage/session or backend
  const last = window.localStorage.getItem(actionKey) || 0;
  const now = Date.now();
  if (now - last < msThreshold) {
    return false;
  }
  window.localStorage.setItem(actionKey, now);
  return true;
};

// Robust logging utility
export const logSystemEvent = (event, params = {}) => {
  try {
    logEvent(analytics, event, params); // Send to analytics
  } catch (e) {
    // Fallback: console logging
    console.log(`[${new Date().toISOString()}][EVENT] ${event}:`, params);
  }
};

// Error handler and crash reporter
export const handleError = (error, context = "") => {
  // Basic console logging; extend to Crashlytics or BigQuery for production
  console.error(`[${new Date().toISOString()}][ERROR] ${context}:`, error);
  logSystemEvent('client_error', { context, error: error.message || error });
};

// Automated database backup triggers (call from Cloud Functions or admin panel)
export const triggerDatabaseBackup = async () => {
  /* This is a stub for security—actual backups are triggered server-side using Firebase Admin/API integrations [8][11][20] */
  logSystemEvent("database_backup_triggered", {});
};

// Secure function validator for client/server approval flows
export const validateAction = async (params) => {
  // Call a secure Firebase Function to get a validation token, pass with Firestore writes [7]
  // See Firebase docs for implementation
};

