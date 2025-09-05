// dashboard.js
import { db, auth, logSystemEvent, handleError } from '../firebase.js';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  startAfter
} from "firebase/firestore";

// DOM Elements (example selectors - update as per your HTML structure)
const profileEmailElement = document.getElementById('profile-email');
const profileNameElement = document.getElementById('profile-name');
const bookingHistoryTable = document.getElementById('booking-history');
const noticesContainer = document.getElementById('notices');
const adminUsersList = document.getElementById('admin-users-list');
const adminBookingRequests = document.getElementById('admin-bookings-list');
const approveButtonsClass = 'btn-approve';
const rejectButtonsClass = 'btn-reject';

// Pagination state for booking history
let lastVisibleBooking = null;
const BOOKINGS_PAGE_SIZE = 10;

// Load current user profile info
export async function loadUserProfile() {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not logged in.");
    }
    profileEmailElement.textContent = user.email || "N/A";
    profileNameElement.textContent = user.displayName || "N/A";
    logSystemEvent("load_user_profile", { uid: user.uid });
  } catch (error) {
    handleError(error, "loadUserProfile");
  }
}

// Load paginated user booking history with sorting by date descending
export async function loadBookingHistory() {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    let q;
    if (lastVisibleBooking) {
      q = query(
        collection(db, "bookings"),
        where("userId", "==", user.uid),
        orderBy("date", "desc"),
        startAfter(lastVisibleBooking),
        limit(BOOKINGS_PAGE_SIZE)
      );
    } else {
      q = query(
        collection(db, "bookings"),
        where("userId", "==", user.uid),
        orderBy("date", "desc"),
        limit(BOOKINGS_PAGE_SIZE)
      );
    }

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      lastVisibleBooking = querySnapshot.docs[querySnapshot.docs.length - 1];
    }

    querySnapshot.forEach((doc) => {
      const booking = doc.data();
      appendBookingHistoryRow(booking);
    });

    logSystemEvent("load_booking_history", { uid: user.uid });
  } catch (error) {
    handleError(error, "loadBookingHistory");
  }
}

// Helper: Append booking row to table
function appendBookingHistoryRow(booking) {
  if (!bookingHistoryTable) return;
  const row = document.createElement('tr');

  const dateCell = document.createElement('td');
  dateCell.textContent = new Date(booking.date.seconds * 1000).toLocaleString();
  row.appendChild(dateCell);

  const statusCell = document.createElement('td');
  statusCell.textContent = booking.status || "Pending";
  row.appendChild(statusCell);

  const quantityCell = document.createElement('td');
  quantityCell.textContent = booking.quantity || 1;
  row.appendChild(quantityCell);

  bookingHistoryTable.appendChild(row);
}

// Admin: Load all users (with role info)
export async function loadAdminUsers() {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    if (!await isAdmin(user)) throw new Error("User unauthorized");

    const usersQuery = query(collection(db, "users"), orderBy("email", "asc"));
    const snapshot = await getDocs(usersQuery);
    adminUsersList.innerHTML = ""; // Clear old data

    snapshot.forEach(doc => {
      const userData = doc.data();
      const li = document.createElement('li');
      li.textContent = `${userData.email} - Role: ${userData.role}`;
      adminUsersList.appendChild(li);
    });

    logSystemEvent("admin_load_users", { uid: user.uid });
  } catch (error) {
    handleError(error, "loadAdminUsers");
  }
}

// Admin: Load and listen to booking requests
export function listenToBookingRequests() {
  const user = auth.currentUser;
  if (!user) return;

  isAdmin(user).then(isAdminUser => {
    if (!isAdminUser) return;

    const bookingsRef = collection(db, "bookings");
    const q = query(bookingsRef, where("status", "==", "pending"), orderBy("date", "asc"));

    return onSnapshot(q, snapshot => {
      adminBookingRequests.innerHTML = "";
      snapshot.forEach(doc => {
        const booking = doc.data();
        const bookingId = doc.id;

        const div = document.createElement('div');
        div.textContent = `User: ${booking.userId} | Quantity: ${booking.quantity} | Date: ${new Date(booking.date.seconds * 1000).toLocaleString()}`;

        // Approve button
        const approveBtn = document.createElement('button');
        approveBtn.textContent = "Approve";
        approveBtn.classList.add(approveButtonsClass);
        approveBtn.onclick = () => handleBookingApproval(bookingId, true);

        // Reject button
        const rejectBtn = document.createElement('button');
        rejectBtn.textContent = "Reject";
        rejectBtn.classList.add(rejectButtonsClass);
        rejectBtn.onclick = () => handleBookingApproval(bookingId, false);

        div.appendChild(approveBtn);
        div.appendChild(rejectBtn);

        adminBookingRequests.appendChild(div);
      });
    });
  }).catch(error => handleError(error, "listenToBookingRequests"));
}

// Admin: Approve or reject booking requests
export async function handleBookingApproval(bookingId, approve) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    if (!await isAdmin(user)) throw new Error("User unauthorized");

    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, { status: approve ? "approved" : "rejected" });

    logSystemEvent("booking_approval_changed", { uid: user.uid, bookingId, approved: approve });
  } catch (error) {
    handleError(error, "handleBookingApproval");
  }
}

// Load and display admin notices and user notices in container
export async function loadNotices() {
  try {
    const noticesRef = collection(db, "notices");
    const snapshot = await getDocs(noticesRef);
    noticesContainer.innerHTML = ""; 

    snapshot.forEach(doc => {
      const notice = doc.data();
      const p = document.createElement('p');
      p.textContent = `${notice.date ? new Date(notice.date.seconds * 1000).toLocaleString() : ''}: ${notice.message}`;
      noticesContainer.appendChild(p);
    });

    logSystemEvent("load_notices");
  } catch (error) {
    handleError(error, "loadNotices");
  }
}

// Utility: Check admin role based on user's Firestore 'role' field
export async function isAdmin(user) {
  try {
    const userDoc = await db.collection("users").doc(user.uid).get();
    return userDoc.exists && userDoc.data().role === "admin";
  } catch {
    return false;
  }
}
