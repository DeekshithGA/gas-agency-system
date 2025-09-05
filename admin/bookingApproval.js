// bookingApproval.js
import { db, auth, logSystemEvent, handleError, canProceedByRateLimit } from '../firebase.js';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";

// DOM Elements placeholders (update according to your HTML)
const requestsContainer = document.getElementById('booking-requests');
const undoStack = []; // Hold last rejected booking timestamps to allow undo

// Check if user is admin by role stored in Firestore
async function isAdmin(user) {
  try {
    const userDoc = await db.collection("users").doc(user.uid).get();
    return userDoc.exists && userDoc.data().role === "admin";
  } catch {
    return false;
  }
}

// Load and listen to pending booking requests in real-time
export async function listenToPendingBookings() {
  const user = auth.currentUser;
  if (!user) return;
  if (!await isAdmin(user)) {
    console.warn("Unauthorized user tried to access booking requests");
    return;
  }

  const bookingsRef = collection(db, "bookings");
  const q = query(bookingsRef, where("status", "==", "pending"), orderBy("date", "asc"));

  return onSnapshot(q, snapshot => {
    requestsContainer.innerHTML = "";
    snapshot.forEach(doc => {
      const booking = doc.data();
      const bookingId = doc.id;

      const div = document.createElement('div');
      div.className = "booking-request";
      div.textContent = `UserId: ${booking.userId} | Quantity: ${booking.quantity} | Date: ${new Date(booking.date.seconds * 1000).toLocaleString()}`;

      // Approve button
      const approveBtn = document.createElement('button');
      approveBtn.textContent = "Approve";
      approveBtn.onclick = () => handleApproval(bookingId, true);

      // Reject button
      const rejectBtn = document.createElement('button');
      rejectBtn.textContent = "Reject";
      rejectBtn.onclick = () => handleApproval(bookingId, false);

      div.appendChild(approveBtn);
      div.appendChild(rejectBtn);

      requestsContainer.appendChild(div);
    });
  });
}

// Approve or reject booking with logging & limitation
export async function handleApproval(bookingId, isApprove) {
  if (!await canProceedByRateLimit('booking_approval', 3000)) {
    alert("Please wait a moment before approving or rejecting another booking.");
    return;
  }
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not logged in");
    if (!await isAdmin(user)) throw new Error("User unauthorized");

    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, {
      status: isApprove ? "approved" : "rejected",
      approvedBy: user.uid,
      approvedAt: new Date()
    });

    logSystemEvent('booking_status_changed', { bookingId, approved: isApprove, adminUid: user.uid });

    if (!isApprove) {
      undoStack.push({ bookingId, timestamp: Date.now() });
      alert("Booking rejected. You can undo within 2 minutes.");
      setTimeout(() => removeUndo(bookingId), 120000); // Undo window 2 minutes
    } else {
      alert("Booking approved successfully.");
    }

    // Optionally trigger email or push notification for status change
    // triggerEmailNotification(bookingId, isApprove);

  } catch (error) {
    handleError(error, "handleApproval");
    alert("An error occurred: " + error.message);
  }
}

// Undo rejection within time window
export async function undoRejection(bookingId) {
  try {
    const entryIndex = undoStack.findIndex(item => item.bookingId === bookingId);
    if (entryIndex === -1) {
      alert("Undo time window expired or invalid booking.");
      return;
    }
    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, {
      status: "pending",
      approvedBy: null,
      approvedAt: null
    });
    undoStack.splice(entryIndex, 1);
    alert("Rejection undone; booking reset to pending.");
    logSystemEvent('booking_rejection_undone', { bookingId, adminUid: auth.currentUser.uid });
  } catch (error) {
    handleError(error, "undoRejection");
    alert("Failed to undo rejection: " + error.message);
  }
}

function removeUndo(bookingId) {
  const index = undoStack.findIndex(item => item.bookingId === bookingId);
  if (index !== -1) {
    undoStack.splice(index, 1);
  }
}

// Placeholder for notification trigger (implement your SMTP or Firebase Cloud Functions)
async function triggerEmailNotification(bookingId, isApproved) {
  // Example:
  // call Firebase Cloud Function that sends email to user about booking status
  // await invokeCloudFunction('sendBookingStatusEmail', { bookingId, approved: isApproved });
}


