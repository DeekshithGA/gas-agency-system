// payment.js
import { db, auth, logSystemEvent, handleError, canProceedByRateLimit } from '../firebase.js';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  startAfter
} from "firebase/firestore";

// DOM Elements placeholders
const paymentHistoryTable = document.getElementById('payment-history-table');

// Payment rate limit for security / abuse protection
const PAYMENT_RATE_LIMIT_MS = 10000;

// Record a payment for a booking
export async function recordPayment(bookingId, amount, method) {
  if (!auth.currentUser) {
    alert("User must be logged in to make payments.");
    return;
  }
  if (!await canProceedByRateLimit('record_payment', PAYMENT_RATE_LIMIT_MS)) {
    alert("Please wait before making another payment.");
    return;
  }
  try {
    if (amount <= 0) {
      throw new Error("Amount must be greater than zero.");
    }
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) throw new Error("Booking not found.");

    const booking = bookingDoc.data();
    if (booking.status !== "approved") {
      alert("Booking must be approved before payment.");
      return;
    }

    // Add payment record
    await addDoc(collection(db, "payments"), {
      bookingId,
      amount,
      method,
      userId: auth.currentUser.uid,
      date: new Date()
    });

    // Optionally update booking payment status or cumulative amounts
    await updateDoc(bookingRef, { paymentStatus: "paid" });

    logSystemEvent("payment_recorded", { bookingId, amount, method, userId: auth.currentUser.uid });

    alert("Payment recorded successfully.");
  } catch (error) {
    handleError(error, "recordPayment");
    alert("Payment failed: " + error.message);
  }
}

// Load paginated payment history for current user
let lastVisiblePayment = null;
const PAGE_SIZE = 10;
export async function loadPaymentHistory(isLoadMore = false) {
  try {
    if (!auth.currentUser) throw new Error("User not authenticated");

    let q;
    if (isLoadMore && lastVisiblePayment) {
      q = query(
        collection(db, "payments"),
        where("userId", "==", auth.currentUser.uid),
        orderBy("date", "desc"),
        startAfter(lastVisiblePayment),
        limit(PAGE_SIZE)
      );
    } else {
      q = query(
        collection(db, "payments"),
        where("userId", "==", auth.currentUser.uid),
        orderBy("date", "desc"),
        limit(PAGE_SIZE)
      );
      if(paymentHistoryTable) paymentHistoryTable.innerHTML = "";
    }

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      lastVisiblePayment = snapshot.docs[snapshot.docs.length - 1];
    }

    snapshot.forEach(doc => {
      appendPaymentRow(doc.data());
    });

    logSystemEvent("load_payment_history", { uid: auth.currentUser.uid });

  } catch (error) {
    handleError(error, "loadPaymentHistory");
  }
}

// Append a payment entry row to UI payment table
function appendPaymentRow(payment) {
  if (!paymentHistoryTable) return;
  const row = document.createElement('tr');

  const dateCell = document.createElement('td');
  dateCell.textContent = payment.date.toDate ? payment.date.toDate().toLocaleString() : new Date(payment.date).toLocaleString();
  row.appendChild(dateCell);

  const amountCell = document.createElement('td');
  amountCell.textContent = payment.amount.toFixed(2);
  row.appendChild(amountCell);

  const methodCell = document.createElement('td');
  methodCell.textContent = payment.method || "N/A";
  row.appendChild(methodCell);

  paymentHistoryTable.appendChild(row);
}

// Refund payment (Admin only: call with admin auth elsewhere)
export async function refundPayment(paymentId) {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    await updateDoc(paymentRef, { status: "refunded", refundedAt: new Date() });
    logSystemEvent("payment_refunded", { paymentId, adminUid: auth.currentUser?.uid });
    alert("Payment refunded successfully.");
  } catch (error) {
    handleError(error, "refundPayment");
    alert("Refund failed: " + error.message);
  }
}

// Payment gateway integration stub (expand as needed)
export async function processOnlinePayment(bookingId, amount, paymentToken) {
  try {
    // Integrate with payment gateway API here
    // For example, call cloud function to process payment securely

    // On success, record payment
    await recordPayment(bookingId, amount, "Online");

  } catch (error) {
    handleError(error, "processOnlinePayment");
    alert("Online payment failed: " + error.message);
  }
}
