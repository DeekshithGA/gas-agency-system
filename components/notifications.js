// notifications.js
import { db, auth, logSystemEvent, handleError } from '../firebase.js';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  doc,
  updateDoc
} from "firebase/firestore";

// DOM Elements
const notificationBell = document.getElementById('notification-bell');
const notificationBadge = document.getElementById('notification-badge');
const notificationCenter = document.getElementById('notification-center');
const notificationSearch = document.getElementById('notification-search');
const notificationMarkAllBtn = document.getElementById('mark-all-read');
const notificationSound = new Audio('/sounds/notification.mp3');

let lastVisibleNotification = null;
const PAGE_SIZE = 10;
let notifications = [];
let unreadCount = 0;

// Listen for new notifications (real-time in Firestore)
export function listenToNotifications() {
  if (!auth.currentUser) return;
  const userId = auth.currentUser.uid;
  const notificationsRef = collection(db, "notifications");
  const q = query(
    notificationsRef,
    where("userId", "==", userId),
    orderBy("date", "desc"),
    limit(PAGE_SIZE)
  );

  onSnapshot(q, snapshot => {
    notifications = [];
    unreadCount = 0;
    notificationCenter.innerHTML = "";
    snapshot.forEach(docSnapshot => {
      const notification = { id: docSnapshot.id, ...docSnapshot.data() };
      notifications.push(notification);
      if (!notification.read) unreadCount++;
      renderNotificationItem(notification);
    });
    updateBadge(unreadCount);
    if (unreadCount > 0) playSound();
  });
}

// Update notification bell badge
function updateBadge(count) {
  if (!notificationBadge) return;
  notificationBadge.textContent = count > 0 ? count : '';
  notificationBadge.style.display = count > 0 ? 'inline-block' : 'none';
  notificationBell.setAttribute('aria-label', `You have ${count} unread notifications`);
}

// Render notification item in center
function renderNotificationItem(notification) {
  const div = document.createElement('div');
  div.className = 'notification-item' + (notification.read ? '' : ' unread');
  div.setAttribute('tabindex', '0');
  div.setAttribute('role', 'button');
  div.innerHTML = `
    <span class="notification-title">${notification.title || 'Notice'}</span>
    <span class="notification-date">${new Date(notification.date.seconds * 1000).toLocaleString()}</span>
    <p class="notification-body">${notification.message}</p>
    <button class="notification-read-btn">${notification.read ? 'Read' : 'Mark as Read'}</button>
  `;
  div.querySelector('.notification-read-btn').onclick = () => markAsRead(notification.id, div);
  notificationCenter.appendChild(div);
}

// Mark notification as read and update UI
export async function markAsRead(notificationId, element = null) {
  try {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, { read: true });
    if (element) element.classList.remove('unread');
    logSystemEvent('notification_read', { uid: auth.currentUser.uid, notificationId });
    listenToNotifications(); // Refresh list and badge
  } catch (error) {
    handleError(error, "markAsRead");
  }
}

// Mark all notifications as read
export async function markAllAsRead() {
  try {
    const userId = auth.currentUser.uid;
    notifications.forEach(async notification => {
      if (!notification.read) await markAsRead(notification.id);
    });
    logSystemEvent('notifications_marked_all_read', { uid: userId });
    listenToNotifications();
  } catch (error) {
    handleError(error, "markAllAsRead");
  }
}

// Search and filter notifications by term
export function filterNotifications(term) {
  notificationCenter.innerHTML = "";
  notifications.forEach(notification => {
    if (
      notification.title.toLowerCase().includes(term.toLowerCase()) ||
      notification.message.toLowerCase().includes(term.toLowerCase())
    ) {
      renderNotificationItem(notification);
    }
  });
}

// Play sound for new notifications
function playSound() {
  notificationSound.play().catch(() => {});
}

// Desktop browser notification using the Notifications API
export function sendDesktopNotification(notification) {
  if (window.Notification && Notification.permission === 'granted') {
    new Notification(notification.title || "Notice", {
      body: notification.message,
      icon: "/images/icon.png"
    });
  }
}

// Request desktop notification permissions on load
if (window.Notification && Notification.permission !== "granted") {
  Notification.requestPermission();
}

// Pagination support for older notifications (load more)
export async function loadMoreNotifications() {
  if (!auth.currentUser) return;
  const userId = auth.currentUser.uid;
  const notificationsRef = collection(db, "notifications");
  let q;
  if (lastVisibleNotification) {
    q = query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("date", "desc"),
      startAfter(lastVisibleNotification),
      limit(PAGE_SIZE)
    );
  } else {
    q = query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("date", "desc"),
      limit(PAGE_SIZE)
    );
  }
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    lastVisibleNotification = snapshot.docs[snapshot.docs.length - 1];
  }
  snapshot.forEach(docSnapshot => {
    const notification = { id: docSnapshot.id, ...docSnapshot.data() };
    notifications.push(notification);
    renderNotificationItem(notification);
  });
}

// Bind search box and mark all as read button
if (notificationSearch) {
  notificationSearch.addEventListener('input', e => {
    filterNotifications(e.target.value);
  });
}
if (notificationMarkAllBtn) {
  notificationMarkAllBtn.addEventListener('click', e => {
    e.preventDefault();
    markAllAsRead();
  });
}
