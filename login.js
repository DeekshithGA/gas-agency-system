// login.js
import { auth, analytics, logSystemEvent, canProceedByRateLimit, handleError, refreshCustomClaims } from '../firebase.js';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from "firebase/auth";

// Utility: Show notification (implement with your UI framework)
function showNotification(type, message) {
  alert(`[${type}] ${message}`);
}

// Email/Password Login with Email Verification and Rate Limiting
export async function loginWithEmail(email, password) {
  if (!await canProceedByRateLimit('login_attempt', 3000)) {
    showNotification('error', 'Too many attempts, please wait...');
    return;
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (!user.emailVerified) {
      showNotification('error', 'Please verify your email before logging in.');
      logSystemEvent('login_failed_unverified', { email });
      await auth.signOut();
      return;
    }
    // Optionally refresh custom claims (roles) after login
    refreshCustomClaims(user);
    logSystemEvent('login_success', { email, uid: user.uid });
    showNotification('success', 'Login successful!');
    // Check for multi-factor authentication enrollment
    const mfa = user.multiFactor.enrolledFactors;
    if (mfa.length === 0) {
      showNotification('warning', 'Consider enabling multi-factor authentication for better security.');
    }
    // Redirect to dashboard or intended route
    window.location.href = '/dashboard.html';
  } catch (error) {
    handleError(error, 'loginWithEmail');
    showNotification('error', error.message);
    logSystemEvent('login_failed', { email, error: error.message });
  }
}

// Google OAuth Login with Logging
export async function loginWithGoogle() {
  if (!await canProceedByRateLimit('login_attempt_google', 3000)) {
    showNotification('error', 'Too many attempts, please wait...');
    return;
  }
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    // Log activity and optionally check verification/mfa
    logSystemEvent('login_google', { email: user.email, uid: user.uid });
    showNotification('success', `Logged in as ${user.displayName}`);
    window.location.href = '/dashboard.html';
  } catch (error) {
    handleError(error, 'loginWithGoogle');
    showNotification('error', error.message);
    logSystemEvent('login_failed_google', { error: error.message });
  }
}

// Password Reset Flow
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    showNotification('info', 'Password reset email sent. Please check your inbox.');
    logSystemEvent('password_reset_requested', { email });
  } catch (error) {
    handleError(error, 'resetPassword');
    showNotification('error', error.message);
    logSystemEvent('password_reset_failed', { email, error: error.message });
  }
}

// Monitor user state, log and enforce route protection
export function monitorLogin(callback) {
  auth.onAuthStateChanged(user => {
    if (user) {
      logSystemEvent('user_authenticated', { email: user.email, uid: user.uid });
      callback(user);
    } else {
      logSystemEvent('user_unauthenticated', {});
      callback(null);
      // Optionally redirect to login page
    }
  });
}
