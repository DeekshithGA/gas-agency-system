// register.js
import { auth, db, logSystemEvent, handleError } from '../firebase.js';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

// Utility: Show notification (customize to your UI framework)
function showNotification(type, message) {
  alert(`[${type}] ${message}`);
}

// Password strength check (example: min 8 chars, 1 number, 1 uppercase)
function isStrongPassword(password) {
  const strongRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
  return strongRegex.test(password);
}

// Register user with email, password, confirm password, and optional full name
export async function registerUser(email, password, confirmPassword, fullName = "") {
  if (!email || !password || !confirmPassword) {
    showNotification('error', 'Please fill all required fields.');
    return;
  }
  if (password !== confirmPassword) {
    showNotification('error', 'Passwords do not match.');
    return;
  }
  if (!isStrongPassword(password)) {
    showNotification('error', 'Password must be at least 8 characters, include an uppercase letter and a number.');
    return;
  }
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update profile with display name if provided
    if (fullName) {
      await updateProfile(user, { displayName: fullName });
    }

    // Send verification email
    await sendEmailVerification(user);
    showNotification('info', 'Verification email sent. Please check your inbox.');

    // Save additional info in Firestore users collection
    await setDoc(doc(db, "users", user.uid), {
      email,
      fullName,
      barrels: 12, // initial allocation
      role: "user",
      createdAt: new Date()
    });

    logSystemEvent('user_registered', { email, uid: user.uid });

    // Optional: Redirect user to a "verify email" page or login
    // window.location.href = "/verify-email.html";

  } catch (error) {
    handleError(error, 'registerUser');
    showNotification('error', error.message);
    logSystemEvent('registration_failed', { email, error: error.message });
  }
}
