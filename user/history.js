// history.js
import { db, auth, logSystemEvent, handleError } from '../firebase.js';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  startAfter
} from "firebase/firestore";

// DOM elements (update as per your UI)
const bookingHistoryTable = document.getElementById('booking-history-table');
const paymentHistoryTable = document.getElementById('payment-history-table');
const loadMoreBookingsBtn = document.getElementById('load-more-bookings');
const loadMorePaymentsBtn = document.getElementById('load-more-payments');

// Pagination and state
const PAGE_SIZE = 10;
let lastBookingVisible = null;
let lastPaymentVisible = null;

// Load bookings with pagination, ordering newest first
export async function loadBookingHistory(isLoadMore = false) {
  try {
    if (!auth.currentUser) throw new Error("User not authenticated");

    let q;
    if (isLoadMore && lastBookingVisible) {
      q = query(
        collection(db, "bookings"),
        where("userId", "==", auth.currentUser.uid),
        orderBy("date", "desc"),
        startAfter(lastBookingVisible),
        limit(PAGE_SIZE)
      );
    } else {
      q = query(
        collection(db, "bookings"),
        where("userId", "==", auth.currentUser.uid),
        orderBy("date", "desc"),
        limit(PAGE_SIZE)
      );
      // Clear table on fresh load
      bookingHistoryTable.innerHTML = "";
    }

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      lastBookingVisible = snapshot.docs[snapshot.docs.length - 1];
    }

    snapshot.forEach(doc => {
      appendBookingRow(doc.data());
    });

    logSystemEvent("load_booking_history", { uid: auth.currentUser.uid });

  } catch (error) {
    handleError(error, "loadBookingHistory");
  }
}

// Append single booking row to booking history table
function appendBookingRow(booking) {
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

// Load payment history with pagination
export async function loadPaymentHistory(isLoadMore = false) {
  try {
    if (!auth.currentUser) throw new Error("User not authenticated");

    let q;
    if (isLoadMore && lastPaymentVisible) {
      q = query(
        collection(db, "payments"),
        where("userId", "==", auth.currentUser.uid),
        orderBy("date", "desc"),
        startAfter(lastPaymentVisible),
        limit(PAGE_SIZE)
      );
    } else {
      q = query(
        collection(db, "payments"),
        where("userId", "==", auth.currentUser.uid),
        orderBy("date", "desc"),
        limit(PAGE_SIZE)
      );
      paymentHistoryTable.innerHTML = "";
    }

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      lastPaymentVisible = snapshot.docs[snapshot.docs.length - 1];
    }

    snapshot.forEach(doc => {
      appendPaymentRow(doc.data());
    });

    logSystemEvent("load_payment_history", { uid: auth.currentUser.uid });

  } catch (error) {
    handleError(error, "loadPaymentHistory");
  }
}

// Append single payment row to payment history table
function appendPaymentRow(payment) {
  if (!paymentHistoryTable) return;
  const row = document.createElement('tr');

  const dateCell = document.createElement('td');
  dateCell.textContent = new Date(payment.date.seconds * 1000).toLocaleString();
  row.appendChild(dateCell);

  const amountCell = document.createElement('td');
  amountCell.textContent = payment.amount.toFixed(2);
  row.appendChild(amountCell);

  const methodCell = document.createElement('td');
  methodCell.textContent = payment.method || "N/A";
  row.appendChild(methodCell);

  paymentHistoryTable.appendChild(row);
}

// Export booking history to CSV for user download
export function exportBookingHistoryCSV() {
  if (!bookingHistoryTable) return;
  let csv = "Date,Quantity,Status\n";
  bookingHistoryTable.querySelectorAll("tr").forEach(row => {
    const cells = Array.from(row.children);
    csv += cells.map(td => td.textContent).join(",") + "\n";
  });
  downloadCSV(csv, "booking_history.csv");
}

// Export payment history to CSV
export function exportPaymentHistoryCSV() {
  if (!paymentHistoryTable) return;
  let csv = "Date,Amount,Method\n";
  paymentHistoryTable.querySelectorAll("tr").forEach(row => {
    const cells = Array.from(row.children);
    csv += cells.map(td => td.textContent).join(",") + "\n";
  });
  downloadCSV(csv, "payment_history.csv");
}

// Helper to trigger CSV download
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.setAttribute('download', filename);
  anchor.click();
  URL.revokeObjectURL(url);
}
