// booking.js
import { db, auth, logSystemEvent, handleError, canProceedByRateLimit } from '../firebase.js';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  Timestamp
} from "firebase/firestore";

// DOM elements placeholders (update selectors as per your html)
const bookingBtn = document.getElementById('book-cylinder-btn');
const cancelBtn = document.getElementById('cancel-booking-btn');
const bookingHistoryTable = document.getElementById('booking-history');

// User quota for barrels per year - assume 12 to start
const MAX_BARRELS_PER_YEAR = 12;

// Booking rate limit (avoid spam)
const BOOKING_RATE_LIMIT_MS = 10000;

// Book a cylinder function with quota check and inventory check
export async function bookCylinder(quantity = 1) {
  if (!auth.currentUser) {
    alert("You must be logged in to book a cylinder.");
    return;
  }
  if (!await canProceedByRateLimit('book_cylinder', BOOKING_RATE_LIMIT_MS)) {
    alert("Please wait a moment before making another booking.");
    return;
  }

  try {
    const userId = auth.currentUser.uid;

    // Check quota and existing bookings this year
    const currentYearStart = new Date(new Date().getFullYear(), 0, 1);
    const bookingsSnapshot = await getDocs(query(collection(db, "bookings"),
      where("userId", "==", userId),
      where("date", ">=", Timestamp.fromDate(currentYearStart)),
      where("status", "in", ["approved", "pending"])
    ));
    let bookedBarrelsThisYear = 0;
    bookingsSnapshot.forEach(doc => {
      bookedBarrelsThisYear += doc.data().quantity || 1;
    });

    if ((bookedBarrelsThisYear + quantity) > MAX_BARRELS_PER_YEAR) {
      alert("You have exceeded your annual cylinder booking quota.");
      return;
    }

    // Optional: check inventory available from admin panel via Firestore (stubbed here)

    // Create booking document with status pending
    await addDoc(collection(db, "bookings"), {
      userId,
      quantity,
      date: Timestamp.now(),
      status: "pending",
    });

    logSystemEvent("booking_created", { userId, quantity });

    alert("Cylinder booking request submitted successfully. Await admin approval.");

    // Optional: trigger email notification via backend function
    // await triggerBookingEmailNotification(userId, quantity);

  } catch (error) {
    handleError(error, "bookCylinder");
    alert("Failed to submit booking request: " + error.message);
  }
}

// Cancel a pending booking if within allowable cancellation window
export async function cancelPendingBooking(bookingId) {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) throw new Error("Booking not found");

    const booking = bookingDoc.data();
    if (booking.status !== "pending") {
      alert("Only pending bookings can be canceled.");
      return;
    }

    const bookingDate = booking.date.toDate();
    const now = new Date();
    const diffHours = (now - bookingDate) / 1000 / 3600;

    if (diffHours > 2) { // 2-hour cancellation window, adjust as needed
      alert("Cancellation window for this booking has expired.");
      return;
    }

    // Mark booking as canceled
    await updateDoc(bookingRef, { status: "canceled" });

    logSystemEvent("booking_canceled", { bookingId, userId: auth.currentUser.uid });

    alert("Booking canceled successfully.");

  } catch (error) {
    handleError(error, "cancelPendingBooking");
    alert("Failed to cancel booking: " + error.message);
  }
}

// Load booking history with pagination
let lastVisible = null;
const PAGE_SIZE = 10;
export async function loadBookingHistory() {
  try {
    if (!auth.currentUser) throw new Error("User not authenticated");

    let bookingsQuery;
    if (lastVisible) {
      bookingsQuery = query(
        collection(db, "bookings"),
        where("userId", "==", auth.currentUser.uid),
        orderBy("date", "desc"),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );
    } else {
      bookingsQuery = query(
        collection(db, "bookings"),
        where("userId", "==", auth.currentUser.uid),
        orderBy("date", "desc"),
        limit(PAGE_SIZE)
      );
    }

    const snapshot = await getDocs(bookingsQuery);
    if (!snapshot.empty) {
      lastVisible = snapshot.docs[snapshot.docs.length - 1];
    }

    snapshot.forEach(doc => {
      appendBookingHistoryRow(doc.data());
    });

    logSystemEvent("load_booking_history", { uid: auth.currentUser.uid });

  } catch (error) {
    handleError(error, "loadBookingHistory");
  }
}

// Helper to append booking info row to UI
function appendBookingHistoryRow(booking) {
  if (!bookingHistoryTable) return;
  const row = document.createElement('tr');

  const dateCell = document.createElement('td');
  dateCell.textContent = new Date(booking.date.seconds * 1000).toLocaleString();
  row.appendChild(dateCell);

  const quantityCell = document.createElement('td');
  quantityCell.textContent = booking.quantity || 1;
  row.appendChild(quantityCell);

  const statusCell = document.createElement('td');
  statusCell.textContent = booking.status || "Pending";
  row.appendChild(statusCell);

  bookingHistoryTable.appendChild(row);
}

// Placeholder for payment integration
export async function processPayment(bookingId, amount, method) {
  try {
    // Add payment record to Firestore (expand with actual payment gateway integration)
    await addDoc(collection(db, "payments"), {
      bookingId,
      amount,
      method,
      date: Timestamp.now(),
      userId: auth.currentUser.uid
    });
    logSystemEvent("payment_processed", { bookingId, amount, method });
    alert("Payment processed successfully.");
  } catch (error) {
    handleError(error, "processPayment");
    alert("Payment processing failed: " + error.message);
  }
}
