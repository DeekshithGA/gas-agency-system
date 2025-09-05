// notices.js
import { db, auth, logSystemEvent, handleError } from '../firebase.js';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  getDocs
} from "firebase/firestore";

// DOM Elements (update per HTML)
const noticesContainer = document.getElementById('notices-container');
const noticeForm = document.getElementById('notice-form');
const noticeInput = document.getElementById('notice-input');
const noticeTypeSelect = document.getElementById('notice-type');
const searchInput = document.getElementById('notice-search');
const unreadCountBadge = document.getElementById('unread-count');

// User preferences for notice types (can be extended to Firestore-managed user settings)
let userPreferences = {
  showImportant: true,
  showGeneral: true
};

// Track read notices by user (can be stored in Firestore user doc for persistency)
const readNotices = new Set();

// Request permission and play sound for notification
const notificationSound = new Audio('/sounds/notification.mp3');
async function notifyUser(message) {
  if (Notification.permission === "granted") {
    new Notification("Gas Agency Notice", { body: message });
    notificationSound.play();
  } else {
    await Notification.requestPermission();
  }
}

// Real-time listener for notices filtered by user preferences and search
export function listenToNotices() {
  const noticesRef = collection(db, "notices");
  const q = query(noticesRef, orderBy("date", "desc"), limit(50));
  
  return onSnapshot(q, snapshot => {
    noticesContainer.innerHTML = "";
    let unreadCount = 0;
    snapshot.forEach(doc => {
      const notice = doc.data();
      if (!shouldShowNotice(notice)) return;
      const noticeId = doc.id;

      const div = document.createElement('div');
      div.className = 'notice';
      if (!readNotices.has(noticeId)) div.classList.add('unread');

      div.textContent = `${new Date(notice.date.seconds * 1000).toLocaleString()} - ${notice.type.toUpperCase()}: ${notice.message}`;

      div.onclick = () => markAsRead(noticeId, div);

      noticesContainer.appendChild(div);
      if (!readNotices.has(noticeId)) unreadCount++;
    });
    unreadCountBadge.textContent = unreadCount > 0 ? unreadCount : "";
  });
}

// Filter notices by type based on user preferences
function shouldShowNotice(notice) {
  if (notice.type === "important" && !userPreferences.showImportant) return false;
  if (notice.type === "general" && !userPreferences.showGeneral) return false;
  // Add search filter if needed
  if (searchInput && searchInput.value.trim() !== '') {
    return notice.message.toLowerCase().includes(searchInput.value.trim().toLowerCase());
  }
  return true;
}

// Mark a notice as read visually and update tracking
function markAsRead(noticeId, element) {
  if (readNotices.has(noticeId)) return;
  readNotices.add(noticeId);
  if (element) element.classList.remove('unread');
  updateUnreadCount();
  logSystemEvent('notice_read', { uid: auth.currentUser?.uid, noticeId });
  // Optionally persist read state to Firestore user doc here
}

function updateUnreadCount() {
  const count = readNotices.size;
  unreadCountBadge.textContent = count > 0 ? count : "";
}

// Admin: Add new notice (requires admin role check externally)
export async function addNotice(message, type = "general") {
  if (!message) return;
  try {
    await addDoc(collection(db, "notices"), {
      message,
      type, // e.g. 'important' or 'general'
      date: new Date()
    });
    logSystemEvent("notice_added", { message, type, adminUid: auth.currentUser?.uid });
    notifyUser(`New ${type} notice: ${message}`);
    if (noticeForm) noticeForm.reset();
  } catch (error) {
    handleError(error, "addNotice");
  }
}

// Admin: Update existing notice by ID
export async function updateNotice(noticeId, newMessage, newType) {
  try {
    const noticeRef = doc(db, "notices", noticeId);
    const updateData = {};
    if (newMessage) updateData.message = newMessage;
    if (newType) updateData.type = newType;
    await updateDoc(noticeRef, updateData);
    logSystemEvent("notice_updated", { noticeId, adminUid: auth.currentUser?.uid });
  } catch (error) {
    handleError(error, "updateNotice");
  }
}

// Admin: Delete notice by ID
export async function deleteNotice(noticeId) {
  try {
    const noticeRef = doc(db, "notices", noticeId);
    await deleteDoc(noticeRef);
    logSystemEvent("notice_deleted", { noticeId, adminUid: auth.currentUser?.uid });
  } catch (error) {
    handleError(error, "deleteNotice");
  }
}

// Update user preferences externally or via UI form (example)
export function setUserPreferences(preferences) {
  userPreferences = {...userPreferences, ...preferences};
  listenToNotices(); // refresh view
}

// Search box handler to filter notices by message content
if (searchInput) {
  searchInput.addEventListener('input', () => {
    listenToNotices();
  });
}

// Initialize permission on page load for notifications
if (Notification.permission !== "granted") {
  Notification.requestPermission();
}
